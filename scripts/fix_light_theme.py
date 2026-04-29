#!/usr/bin/env python3
"""Bulk-replace all Planzo dark-theme hardcoded colors with poppy light-theme equivalents."""
import os

ROOT = "/Users/bharathkumarr/Downloads/Event Discovery Dashboard/src/app"

# Order matters — longest/most-specific first to avoid partial matches
REPLACEMENTS = [
    # ── Tooltip/recharts dark backgrounds ──
    ('background: "#152018"',   'background: "#ffffff"'),
    ('background: "#162118"',   'background: "#ffffff"'),
    ('background: "#0a0f0d"',   'background: "#fff8f4"'),
    # ── rgba mint borders on recharts tooltips ──
    ('border: "1px solid rgba(74,222,128,0.2)"',  'border: "1px solid rgba(249,115,22,0.25)"'),
    ('border: "1px solid rgba(74,222,128,0.15)"', 'border: "1px solid rgba(249,115,22,0.2)"'),
    # ── Old dark bg hex ──
    ('#0a0f0d',  '#fff8f4'),
    ('#152018',  '#ffffff'),
    ('#162118',  '#ffffff'),
    ('#111f17',  '#fff0e8'),
    ('#0f1a14',  '#fff3ee'),
    # ── Old text colors ──
    ('#f0fdf4',  '#1a0a00'),   # bright near-white → very dark warm brown
    ('#a3e0b5',  '#92400e'),   # mint-secondary text → amber-brown
    ('#5a7a65',  '#78716c'),   # muted mint text → neutral stone
    # ── Old accent greens → orange/coral ──
    ('#4ade80',  '#f97316'),
    ('#22c55e',  '#ef4444'),
    # ── rgba mint glow/border/muted → orange equivalents ──
    ('rgba(74,222,128,0.25)', 'rgba(249,115,22,0.25)'),
    ('rgba(74,222,128,0.20)', 'rgba(249,115,22,0.20)'),
    ('rgba(74,222,128,0.18)', 'rgba(249,115,22,0.15)'),
    ('rgba(74,222,128,0.15)', 'rgba(249,115,22,0.18)'),
    ('rgba(74,222,128,0.10)', 'rgba(249,115,22,0.10)'),
    ('rgba(74,222,128,0.08)', 'rgba(249,115,22,0.08)'),
    ('rgba(74,222,128,0.06)', 'rgba(249,115,22,0.06)'),
    ('rgba(74,222,128,0.04)', 'rgba(249,115,22,0.04)'),
    ('rgba(74,222,128,0.02)', 'rgba(249,115,22,0.02)'),
    # also handle spaces
    ('rgba(74, 222, 128, 0.25)', 'rgba(249,115,22,0.25)'),
    ('rgba(74, 222, 128, 0.1)',  'rgba(249,115,22,0.1)'),
    # ── Button label color (white text on colored bg stays white) ──
    ('"color": "#0a0f0d"',   '"color": "#ffffff"'),
    ("color: \"#0a0f0d\"",   "color: \"#ffffff\""),
    ("color: '#0a0f0d'",     "color: '#ffffff'"),
    # ── Old danger/warning/info neon → richer standard ──
    ('#f87171', '#dc2626'),
    ('#fbbf24', '#d97706'),
    ('#60a5fa', '#2563eb'),
    ('#c084fc', '#7c3aed'),
    # ── Old gradient strings ──
    ('linear-gradient(135deg,#4ade80,#22c55e)', 'linear-gradient(135deg,#f97316,#ef4444)'),
    ('linear-gradient(135deg, #4ade80, #22c55e)', 'linear-gradient(135deg,#f97316,#ef4444)'),
    # ── Old recharts tooltip text ──
    ('color: "#f0fdf4"',     'color: "#1a0a00"'),
    ('"color": "#f0fdf4"',   '"color": "#1a0a00"'),
]

total_files = 0
for dirpath, _, filenames in os.walk(ROOT):
    for fname in filenames:
        if not fname.endswith(".tsx"):
            continue
        fpath = os.path.join(dirpath, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
        new_content = content
        for old, new in REPLACEMENTS:
            new_content = new_content.replace(old, new)
        if new_content != content:
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(new_content)
            total_files += 1
            print(f"  Updated: {fname}")

print(f"\nDone — {total_files} files updated.")
