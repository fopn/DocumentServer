#!/usr/bin/env python3
"""Run after grunt build to inline @@SRC_ROOT@@ scripts into HTML deploy templates."""
import re, os, glob, sys

src_root = '/develop/web-apps'
build_root = os.environ.get('EO_ROOT', '/var/www/euro-office/documentserver')

editors = ['documenteditor', 'spreadsheeteditor', 'presentationeditor', 'pdfeditor', 'visioeditor']
for editor in editors:
    for deploy_file in glob.glob(f'{src_root}/apps/{editor}/main/*.html.deploy'):
        html_name = os.path.basename(deploy_file).replace('.deploy', '')
        dst = f'{build_root}/web-apps/apps/{editor}/main/{html_name}'
        if os.path.exists(dst):
            continue  # already there (some editors don't get cleaned)
        with open(deploy_file) as f:
            html = f.read()
        html = html.replace('@@SRC_ROOT@@', src_root)
        def inline(m):
            path = m.group(1).replace('?__inline=true', '')
            try:
                return '<script>' + open(path).read() + '</script>'
            except:
                return m.group(0)
        html = re.sub(r'<script src="([^"]+\?__inline=true)"></script>', inline, html)
        with open(dst, 'w') as f:
            f.write(html)
        print('Generated:', dst)
