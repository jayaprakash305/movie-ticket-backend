import re

with open(r'c:\Users\ELCOT\Desktop\booking ticket management\ticket booking-backend\src\routes\adminRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken ones
content = re.sub(r'roleMiddleware\("ADMIN",\s*permissionMiddleware\("([^"]+)"\),\s*"SUPER_ADMIN"\),',
                 r'roleMiddleware("ADMIN", "SUPER_ADMIN"),\n  permissionMiddleware("\1"),',
                 content)

# Define regex chunks that didn't mess up but we want to adjust if needed.
# For partners and agents, they look like:
# router.post("/partners", authMiddleware, roleMiddleware("ADMIN","SUPER_ADMIN"), createPartnerBySuperAdmin);
# Let's fix them:
content = re.sub(r'(router\.post\("/partners",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("createPartner"),', content)
content = re.sub(r'(router\.patch\("/partners/:id/approve",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("approvePartner"),', content)
content = re.sub(r'(router\.patch\("/partners/:id/reject",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("rejectPartner"),', content)

content = re.sub(r'(router\.post\("/agents",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("createAgent"),', content)
content = re.sub(r'(router\.patch\("/agents/:id/approve",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("approveAgent"),', content)
content = re.sub(r'(router\.patch\("/agents/:id/reject",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("rejectAgent"),', content)

content = re.sub(r'(router\.patch\("/agents/:id/status-approve",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("approveStatusRequest"),', content)
content = re.sub(r'(router\.patch\("/agents/:id/status-reject",\s*authMiddleware,\s*roleMiddleware\("ADMIN","SUPER_ADMIN"\)),', r'\1, permissionMiddleware("approveStatusRequest"),', content)


with open(r'c:\Users\ELCOT\Desktop\booking ticket management\ticket booking-backend\src\routes\adminRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done phase 2")
