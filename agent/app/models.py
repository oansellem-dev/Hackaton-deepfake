"""Accès aux modèles : depuis le cache local d'abord, sans réseau.

Sur un Wi-Fi d'événement, une simple vérification de version auprès de Hugging Face peut rester bloquée.
Le réseau ne sert donc qu'au tout premier téléchargement d'un modèle.
"""
from huggingface_hub import hf_hub_download
from huggingface_hub.errors import LocalEntryNotFoundError


def model_path(repo: str, filename: str) -> str:
    try:
        return hf_hub_download(repo, filename, local_files_only=True)
    except LocalEntryNotFoundError:
        return hf_hub_download(repo, filename)
