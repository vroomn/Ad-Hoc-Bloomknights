# syntax=docker/dockerfile:1

# Use the official Python runtime image
FROM python:3.13  
 
WORKDIR /app

COPY . /app

RUN pip install -r requirements.txt

EXPOSE 5000

CMD ["flask", "--app", "flaskr", "run", "--debug", "--host=0.0.0.0"]