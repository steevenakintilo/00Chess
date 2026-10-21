"""Les erreurs de validation de l'API renvoient des codes stables (ex. "taken") et non des phrases :
c'est le front qui les traduit dans la langue du joueur."""
from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.views import exception_handler


def _codes(detail):
    if isinstance(detail, ErrorDetail):
        return detail.code
    if isinstance(detail, list):
        return [_codes(item) for item in detail]
    if isinstance(detail, dict):
        return {key: _codes(value) for key, value in detail.items()}
    return detail


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None and isinstance(exc, ValidationError):
        response.data = _codes(exc.detail)
    return response
