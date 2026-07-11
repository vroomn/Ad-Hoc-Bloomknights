
class Query:
    def __init__(self, context, message) -> None:
        self.location = context
        self.message = message
        pass

    def responsd(self):
        return "This is a canned response"
