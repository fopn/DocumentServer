import re

de = "/var/www/euro-office/documentserver/web-apps/apps/documenteditor/main"
files = [de + "/index.html", de + "/index_loader.html"]

favicon_old = '<link rel="icon" href="resources/img/favicon.ico" type="image/x-icon">'
favicon_new = '<link rel="icon" href="resources/img/favicon.svg" type="image/svg+xml">\n    <link rel="alternate icon" href="resources/img/favicon.ico" type="image/x-icon">'

for path in files:
    with open(path, "r") as f:
        content = f.read()
    content = re.sub(r"<title>[^<]*</title>", "<title>FileOpen Document Editor</title>", content)
    if favicon_old in content:
        content = content.replace(favicon_old, favicon_new)
    with open(path, "w") as f:
        f.write(content)
    print("Updated:", path)

print("Done")
