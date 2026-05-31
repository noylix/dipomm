import re


def ru_phone_digits(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if not digits:
        return ""
    if digits.startswith("8"):
        digits = f"7{digits[1:]}"
    if not digits.startswith("7"):
        digits = f"7{digits}"
    return digits[:11]


def format_ru_phone(phone: str) -> str:
    digits = ru_phone_digits(phone)
    if len(digits) != 11:
        return (phone or "").strip()
    return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:11]}"


def is_valid_ru_phone(phone: str) -> bool:
    digits = ru_phone_digits(phone)
    return len(digits) == 11 and digits.startswith("7")
