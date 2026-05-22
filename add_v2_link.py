import re

with open('frontend/src/components/AppointmentsWithAttention.jsx', 'r') as f:
    content = f.read()

# Find the actions section for dental appointments
# Search for the "Atender" button or similar
link_insert = """
                  {ENABLE_DENTAL_V2 && app.especialidad === "Odontología" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-2 border-medical-500 text-medical-600 hover:bg-medical-50"
                      onClick={() => window.location.href = `/odontologia-v2/${app.id}`}
                    >
                      Workspace V2
                    </Button>
                  )}
"""

# Import ENABLE_DENTAL_V2
content = 'import { ENABLE_DENTAL_V2 } from "@/lib/constants";\n' + content

# This is a bit risky, let's try to find a good spot.
# In AppointmentsWithAttention.jsx, look for where buttons are rendered.
