#!/usr/bin/env python3
"""
Robust JavaScript Minifier & Bookmarklet Packager.
Compiles src/bookmarklet.js, generates dist/bookmarklet.min.js & dist/bookmarklet.url.txt,
and statically injects the bookmarklet code directly into index.html so it works
locally without any network or fetch() calls.
"""

import os
import urllib.parse
import subprocess
import html

def strip_comments_and_minify(js_code: str) -> str:
    out = []
    i = 0
    n = len(js_code)
    
    in_single_quote = False
    in_double_quote = False
    in_template_lit = False
    in_block_comment = False
    in_line_comment = False
    in_regex = False
    
    last_non_ws = ''

    while i < n:
        c = js_code[i]
        next_c = js_code[i + 1] if i + 1 < n else ''

        # Line comment
        if in_line_comment:
            if c == '\n':
                in_line_comment = False
                out.append('\n')
            i += 1
            continue

        # Block comment
        if in_block_comment:
            if c == '*' and next_c == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        # Regex literal
        if in_regex:
            out.append(c)
            if c == '\\':
                if i + 1 < n:
                    i += 1
                    out.append(js_code[i])
            elif c == '/':
                in_regex = False
                last_non_ws = '/'
            i += 1
            continue

        # Single quote string
        if in_single_quote:
            out.append(c)
            if c == '\\':
                if i + 1 < n:
                    i += 1
                    out.append(js_code[i])
            elif c == "'":
                in_single_quote = False
                last_non_ws = "'"
            i += 1
            continue

        # Double quote string
        if in_double_quote:
            out.append(c)
            if c == '\\':
                if i + 1 < n:
                    i += 1
                    out.append(js_code[i])
            elif c == '"':
                in_double_quote = False
                last_non_ws = '"'
            i += 1
            continue

        # Template literal
        if in_template_lit:
            out.append(c)
            if c == '\\':
                if i + 1 < n:
                    i += 1
                    out.append(js_code[i])
            elif c == '`':
                in_template_lit = False
                last_non_ws = '`'
            i += 1
            continue

        # Check comment start
        if c == '/' and next_c == '/':
            in_line_comment = True
            i += 2
            continue

        if c == '/' and next_c == '*':
            in_block_comment = True
            i += 2
            continue

        # Check regex start
        if c == '/' and last_non_ws in '(=:[,!&|?;{}+-*%':
            in_regex = True
            out.append(c)
            i += 1
            continue

        # Check string start
        if c == "'":
            in_single_quote = True
            out.append(c)
            i += 1
            continue

        if c == '"':
            in_double_quote = True
            out.append(c)
            i += 1
            continue

        if c == '`':
            in_template_lit = True
            out.append(c)
            i += 1
            continue

        if not c.isspace():
            last_non_ws = c

        out.append(c)
        i += 1

    clean_code = ''.join(out)

    lines = clean_code.split('\n')
    compacted_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped:
            compacted_lines.append(stripped)

    return '\n'.join(compacted_lines)

def make_bookmarklet_url(js_code: str) -> str:
    # URL encode for safe bookmarklet URI in all browsers
    return 'javascript:' + urllib.parse.quote(js_code, safe="~*'()")

def update_index_html(html_path: str, bookmarklet_url: str):
    with open(html_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace href of #main-bookmarklet-link
    # Look for href="#" or existing href
    import re
    # Match the <a> tag
    pattern_a = r'(<a\s+id="main-bookmarklet-link"[^>]*?href=")([^"]*?)(")'
    new_content = re.sub(pattern_a, r'\g<1>' + bookmarklet_url + r'\g<3>', content)

    # Match raw-code-box inner text
    pattern_box = r'(<div\s+class="code-box"\s+id="raw-code-box">)([\s\S]*?)(</div>)'
    new_content = re.sub(pattern_box, r'\g<1>' + html.escape(bookmarklet_url) + r'\g<3>', new_content)

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    src_path = os.path.join(root_dir, 'src', 'bookmarklet.js')
    dist_dir = os.path.join(root_dir, 'dist')
    index_path = os.path.join(root_dir, 'index.html')
    os.makedirs(dist_dir, exist_ok=True)

    with open(src_path, 'r', encoding='utf-8') as f:
        src_code = f.read()

    cleaned = strip_comments_and_minify(src_code)
    
    min_path = os.path.join(dist_dir, 'bookmarklet.min.js')
    with open(min_path, 'w', encoding='utf-8') as f:
        f.write(cleaned)

    # Verify syntax with Node.js
    result = subprocess.run(['node', '-c', min_path], capture_output=True, text=True)
    if result.returncode != 0:
        print("ERROR: Syntax error in minified file:")
        print(result.stderr)
        return 1

    bookmarklet_url = make_bookmarklet_url(cleaned)
    url_path = os.path.join(dist_dir, 'bookmarklet.url.txt')
    with open(url_path, 'w', encoding='utf-8') as f:
        f.write(bookmarklet_url)

    # Update index.html statically
    update_index_html(index_path, bookmarklet_url)

    print(f"Build succeeded & validated with Node.js!")
    print(f"Source size: {len(src_code)} bytes")
    print(f"Cleaned size: {len(cleaned)} bytes")
    print(f"Bookmarklet URI size: {len(bookmarklet_url)} bytes")
    print(f"Statically embedded into {index_path}!")
    return 0

if __name__ == '__main__':
    exit(main())
