import sys

path = 'frontend/src/components/PacientesTab.jsx'
with open(path, 'r') as f:
    content = f.read()

# Fix broken patterns
content = content.replace('"/medical-history/general/appointment/${cita.id}"); }', '`/medical-history/general/appointment/${cita.id}`')
content = content.replace('"/medical-history/pediatric/appointment/${cita.id}"); }', '`/medical-history/pediatric/appointment/${cita.id}`')
content = content.replace('"/medical-history/odontology/appointment/${cita.id}"); }', '`/medical-history/odontology/appointment/${cita.id}`')

# Generic cleanup
import re
content = re.sub(r'"/medical-history/([^"]*)/\$\{([^}]*)\}"\);\s*\}', r'`/medical-history/\1/${\2}`', content)

with open(path, 'w') as f:
    f.write(content)
