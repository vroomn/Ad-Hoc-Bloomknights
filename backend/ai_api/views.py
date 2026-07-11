from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status as stat, request


class QueryView(APIView):
    def get(self, request: request.Request):
        query = request.query_params.get("q")

        if not query:
            return Response(
                {"error": "Missing required query parameter"},
                status= stat.HTTP_400_BAD_REQUEST
            )
        
        result = f"You searched for: {query}"
        return Response(result, status=stat.HTTP_200_OK)