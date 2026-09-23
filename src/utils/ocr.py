"""Lightweight local OCR for label photos using the Tesseract executable."""

from __future__ import annotations

import asyncio
import io
import shutil
import subprocess

from PIL import Image, ImageEnhance, ImageOps, UnidentifiedImageError


class OCRUnavailable(Exception):
    """The uploaded image or OCR runtime could not be used."""


def read_image(image_data: bytes) -> list[str]:
    executable = shutil.which("tesseract")
    if not executable:
        raise OCRUnavailable(
            "The label reader is not installed on this server. Enter the medication name manually."
        )
    try:
        with Image.open(io.BytesIO(image_data)) as original:
            image = ImageOps.exif_transpose(original).convert("L")
            if image.width < 80 or image.height < 80:
                raise OCRUnavailable(
                    "This photo is too small to read. Try a closer, sharper photo."
                )
            if image.width < 1400:
                image = image.resize((image.width * 2, image.height * 2))
            image.thumbnail((2800, 2800))
            image = ImageEnhance.Contrast(ImageOps.autocontrast(image)).enhance(1.25)
            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise OCRUnavailable(
            "This image could not be opened. Upload a JPG, PNG, or WebP photo."
        ) from exc
    try:
        result = subprocess.run(
            [executable, "stdin", "stdout", "-l", "eng", "--psm", "11"],
            input=buffer.getvalue(),
            capture_output=True,
            timeout=30,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise OCRUnavailable(
            "The label reader took too long. Try a smaller photo or type the medication name."
        ) from exc
    if result.returncode:
        raise OCRUnavailable(
            "The label reader could not process this photo. Try a clearer image."
        )
    return list(
        dict.fromkeys(
            line.strip()
            for line in result.stdout.decode("utf-8", errors="replace").splitlines()
            if line.strip()
        )
    )[:40]


async def extract_drug_names_from_image(image_data: bytes) -> list[str]:
    return await asyncio.to_thread(read_image, image_data)


async def extract_text_from_image(image_data: bytes, **kwargs) -> str:
    return " ".join(await extract_drug_names_from_image(image_data))
