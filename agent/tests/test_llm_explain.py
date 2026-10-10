from types import SimpleNamespace

import anthropic

from app import llm_explain
from app.schemas import Level, Severity, Signal

SIGNALS = [Signal(id="virtual_camera", severity=Severity.STRONG, penalty=25, message="Caméra virtuelle déclarée.")]


class FakeClient:
    def __init__(self, text=None, stop="end_turn", exc=None):
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)
        self._text, self._stop, self._exc = text, stop, exc

    def _create(self, **kw):
        self.calls.append(kw)
        if self._exc:
            raise self._exc
        return SimpleNamespace(stop_reason=self._stop, content=[SimpleNamespace(type="text", text=self._text)])


def run(client):
    return llm_explain.rewrite(75, Level.GREEN, SIGNALS, client=client)


def test_accepts_faithful_output():
    c = FakeClient("Score 75/100.\nUne caméra virtuelle est déclarée : signal à vérifier.")
    assert "caméra virtuelle" in run(c)
    assert "temperature" not in c.calls[0] and c.calls[0]["model"] == "claude-haiku-5-5"


def test_rejects_invented_number_accusation_and_length():
    assert run(FakeClient("Score 75/100, 3 défis échoués.")) is None
    assert run(FakeClient("C'est un faux candidat.")) is None
    assert run(FakeClient("a\nb\nc\nd")) is None


def test_fallbacks_on_refusal_and_api_error():
    assert run(FakeClient("ok", stop="refusal")) is None
    err = anthropic.APIConnectionError(request=SimpleNamespace())
    assert run(FakeClient(exc=err)) is None


def test_no_key_means_template(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    assert llm_explain.rewrite(75, Level.GREEN, SIGNALS) is None
