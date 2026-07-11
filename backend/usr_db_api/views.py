from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response

from usr_db_api.models import Transaction

import csv, io

# Create your views here.
@api_view(['POST'])
def upload_csv(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({"error": "No file provided"})
    
    decoded = file_obj.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))

    rows = [
        Transaction(
            user=request.user,
            ticker=row['ticker'],
            value=row['value'],
        )
        for row in reader
    ]
    Transaction.objects.bulk_create(rows)
    
    return Response(f"Imported {len(rows)} rows for {request.user}")