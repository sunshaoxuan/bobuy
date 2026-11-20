#!/usr/bin/env python3
"""Read-only release gate. Input is an authorized current master export, not the old CSV.
Expected: {nodes:[{id,fullPath:[ancestor IDs including self]}],
 products:[{id,categoryNodeId,visible:bool}]}. Never exports or changes protected fields.
"""
import argparse
import json
from pathlib import Path


def audit(config, data):
    categories = {c['id']: c for c in config['categories']}
    if len(categories) != len(config['categories']):
        raise ValueError('Duplicate display identity')
    leaves = {k for k, c in categories.items() if c['parentId'] is not None}
    for k in leaves:
        parent = categories.get(categories[k]['parentId'])
        if not parent or parent['parentId'] is not None:
            raise ValueError('Invalid two-level structure')
    nodes = {n['id']: n['fullPath'] for n in data['nodes']}
    products = {p['id']: p for p in data['products']}
    if len(products) != len(data['products']) or len(nodes) != len(data['nodes']):
        raise ValueError('Duplicate source identity')
    mapped = {}
    seen = set()
    for rule in config['rules']:
        node, target = rule['nodeId'], rule['categoryId']
        if node in seen or node not in nodes or target not in leaves:
            raise ValueError('Duplicate/unknown source or invalid target: ' + node)
        seen.add(node)
        for n, path in nodes.items():
            if n == node or rule['subtree'] and node in path:
                if n in mapped:
                    raise ValueError('Overlapping source mapping: ' + n)
                mapped[n] = target
    overrides = {}
    for rule in config['overrides']:
        product, target = rule['productId'], rule['categoryId']
        if product not in products or product in overrides or target not in leaves:
            raise ValueError('Unknown/duplicate product or invalid target: ' + product)
        overrides[product] = target
    counts, visible_counts, missing = {}, {}, []
    for p in products.values():
        if type(p.get('visible')) is not bool:
            raise ValueError('Explicit current visibility required: ' + p['id'])
        target = overrides.get(p['id'], mapped.get(p['categoryNodeId']))
        if not target:
            missing.append(p['id'])
            continue
        counts[target] = counts.get(target, 0) + 1
        if p['visible']:
            visible_counts[target] = visible_counts.get(target, 0) + 1
    return dict(masterTotal=len(products), visibleTotal=sum(p['visible'] for p in products.values()),
                mappedTotal=sum(counts.values()), visibleMappedTotal=sum(visible_counts.values()),
                unmappedProductIds=missing, counts=counts, visibleCounts=visible_counts,
                releaseReady=not missing)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('export', type=Path)
    parser.add_argument('--config', type=Path, default=Path(__file__).resolve().parents[1] / 'backend/src/main/resources/shopping-categories.json')
    args = parser.parse_args()
    result = audit(json.loads(args.config.read_text()), json.loads(args.export.read_text()))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['releaseReady'] else 2)
