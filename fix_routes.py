import re

with open(r'c:\Users\ELCOT\Desktop\booking ticket management\ticket booking-backend\src\routes\adminRoutes.js', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import permissionMiddleware' not in content:
    content = content.replace('import roleMiddleware from "../middleware/roleMiddleware.js"', 
                              'import roleMiddleware from "../middleware/roleMiddleware.js"\nimport permissionMiddleware from "../middleware/permissionMiddleware.js"')

rules = [
    (r'(router\.patch\(\s*"/movie-requests/:id/approve".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveMovieRequest"),'),
    (r'(router\.patch\(\s*"/movie-requests/:id/reject".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveMovieRequest"),'),
    
    (r'(router\.post\(\s*"/movies".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("addMovie"),'),
    
    (r'(router\.post\(\s*"/venues".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("addTheater"),'),
    (r'(router\.put\(\s*"/venues/:venueId".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("editTheater"),'),
    (r'(router\.delete\(\s*"/venues/:venueId".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("deleteTheater"),'),
    
    (r'(router\.post\(\s*"/venues/:venueId/screens".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("addScreen"),'),
    (r'(router\.delete\(\s*"/venues/:venueId/screens/:screenId".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("deleteScreen"),'),
    (r'(router\.patch\(\s*"/venues/:venueId/screens/:screenId/seats".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("editTheater"),'),
    
    (r'(router\.patch\(\s*"/venue-requests/:requestId/approve".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveVenueRequest"),'),
    (r'(router\.patch\(\s*"/venue-requests/:requestId/reject".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveVenueRequest"),'),
    
    (r'(router\.post\(\s*"/shows".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("addShow"),'),
    (r'(router\.put\(\s*"/shows/:showId".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("editShow"),'),
    (r'(router\.delete\(\s*"/shows/:showId".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("deleteShow"),'),
    
    (r'(router\.patch\(\s*"/show-requests/:id/approve".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveShowRequest"),'),
    (r'(router\.patch\(\s*"/show-requests/:id/reject".*?roleMiddleware[^,]+,)', r'\1\n  permissionMiddleware("approveShowRequest"),'),

    (r'(router\.post\("/partners",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("createPartner"),'),
    (r'(router\.patch\("/partners/:id/approve",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("approvePartner"),'),
    (r'(router\.patch\("/partners/:id/reject",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("rejectPartner"),'),

    (r'(router\.post\("/agents",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("createAgent"),'),
    (r'(router\.patch\("/agents/:id/approve",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("approveAgent"),'),
    (r'(router\.patch\("/agents/:id/reject",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("rejectAgent"),'),

    (r'(router\.patch\("/agents/:id/status-approve",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("approveStatusRequest"),'),
    (r'(router\.patch\("/agents/:id/status-reject",.*?roleMiddleware[^,]+\),)', r'\1 permissionMiddleware("approveStatusRequest"),'),
]

for pat, repl in rules:
    content = re.sub(pat, repl, content, flags=re.DOTALL)

with open(r'c:\Users\ELCOT\Desktop\booking ticket management\ticket booking-backend\src\routes\adminRoutes.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
