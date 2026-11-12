"""Reproduce this versioned SQL seed from the archived public-source extracts.

Never fetches live data or writes a database. Future source revisions need a new
migration; pass --output explicitly to avoid changing an existing migration.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / 'docs/reports/evidence/geographic-master-20261112'

def rows():
    countries = json.loads((EVIDENCE / 'countries-extract.json').read_text(encoding='utf-8'))['rows']
    pages = json.loads((EVIDENCE / 'jlis-extract.json').read_text(encoding='utf-8'))
    postal = {r['code']: r for r in json.loads((EVIDENCE / 'postal-extract.json').read_text(encoding='utf-8'))['rows']}
    assert len(countries) == 249 and len(pages) == 47
    result = [(c['alpha_2'], None, 1, c['name'], None) for c in countries]
    codes = set()
    for page in pages:
        prefix = page['rows'][0]['code'][:2]
        names = {r['prefecture'] for r in postal.values() if r['code'].startswith(prefix)}
        assert len(names) == 1, (prefix, names)
        result.append(('JP-' + prefix, 'JP', 2, names.pop(), None))
        for row in page['rows']:
            code = row['code']
            assert re.fullmatch(r'\d{5}', code) and code.startswith(prefix) and code not in codes
            codes.add(code)
            # Postal labels qualify designated-city wards and county towns.
            name = postal[code]['name'] if code in postal else row['name']
            result.append(('JP-' + code, 'JP-' + prefix, 3, name, row['reading']))
    assert len(codes) == 1912 and set(postal) <= codes
    assert len({r[0] for r in result}) == len(result)
    return sorted(result, key=lambda r: (r[2], r[0]))

def literal(value):
    return 'NULL' if value is None else str(value) if isinstance(value, int) else "'" + value.replace("'", "''") + "'"

def generate():
    header = '''-- Geographic reference data, retrieved 2026-11-12.
-- ISO 3166-1: pycountry source snapshot; Japan: J-LIS 47 prefecture lists,
-- cross-checked with Japan Post 2026-10-30 data. Source hashes and extracts:
-- docs/reports/evidence/geographic-master-20261112/. No address data is changed.
CREATE TABLE IF NOT EXISTS bb_geographic_area (
    code VARCHAR(8) PRIMARY KEY,
    parent_code VARCHAR(8),
    level SMALLINT NOT NULL,
    parent_level SMALLINT GENERATED ALWAYS AS (level - 1) STORED,
    name VARCHAR(150) NOT NULL CHECK (length(btrim(name)) > 0),
    reading VARCHAR(150),
    UNIQUE (code, level),
    FOREIGN KEY (parent_code, parent_level) REFERENCES bb_geographic_area(code, level),
    CHECK (
      (level = 1 AND code ~ '^[A-Z]{2}$' AND parent_code IS NULL) OR
      (level = 2 AND code ~ '^[A-Z]{2}-[0-9]{2}$' AND parent_code = left(code, 2) AND parent_code IS NOT NULL) OR
      (level = 3 AND code ~ '^[A-Z]{2}-[0-9]{5}$' AND parent_code = left(code, 5) AND parent_code IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_bb_geographic_area_parent ON bb_geographic_area(parent_code, code);

INSERT INTO bb_geographic_area(code, parent_code, level, name, reading) VALUES
'''
    return header + ',\n'.join('(' + ', '.join(map(literal, row)) + ')' for row in rows()) + '\nON CONFLICT (code) DO NOTHING;\n'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(generate(), encoding='utf-8', newline='\n')
    print('Generated 249 countries, 47 prefectures, 1912 municipalities and wards.')
