class BridgeError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class SillyTavernError(BridgeError):
    def __init__(self, message: str) -> None:
        super().__init__("sillytavern_unavailable", message, 503)
