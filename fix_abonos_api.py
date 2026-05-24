import sys
import re

file_path = 'frontend/src/components/AbonosTab.jsx'
with open(file_path, 'r') as f:
    content = f.read()

# Fix broken quotes/backticks
content = re.sub(r'apiClient\.get\(`/([^`]+)\)', r'apiClient.get(`/\1`)', content)
content = re.sub(r'apiClient\.post\(`/([^`]+)\)', r'apiClient.post(`/\1`)', content)
content = re.sub(r'apiClient\.delete\(`/([^`]+)\)', r'apiClient.delete(`/\1`)', content)

# Clean up headers
content = re.sub(r',\s*\{\s*headers:[^}]+}', '', content)

with open(file_path, 'w') as f:
    f.write(content)
