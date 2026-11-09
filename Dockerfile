FROM python:3.12-slim

WORKDIR /app

# Copy all project files into container
COPY . /app

# Set default port
ENV PORT=5000
EXPOSE 5000

# Start server
CMD ["python", "server.py"]

