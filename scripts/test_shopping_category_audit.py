import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('shopping_audit', Path(__file__).with_name('audit-shopping-categories.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ShoppingAuditTest(unittest.TestCase):
    def setUp(self):
        self.config = dict(categories=[dict(id='shop-root', parentId=None), dict(id='shop-leaf', parentId='shop-root')], rules=[dict(nodeId='source', categoryId='shop-leaf', subtree=True)], overrides=[])
        self.data = dict(nodes=[dict(id='source', fullPath=['source']), dict(id='child', fullPath=['source', 'child'])], products=[dict(id='visible', categoryNodeId='source', visible=True), dict(id='hidden', categoryNodeId='child', visible=False)])

    def test_counts_all_master_and_visible_separately_without_writes(self):
        before = copy.deepcopy(self.data)
        report = module.audit(self.config, self.data)
        self.assertEqual((report['masterTotal'], report['mappedTotal'], report['visibleTotal'], report['visibleMappedTotal']), (2, 2, 1, 1))
        self.assertTrue(report['releaseReady'])
        self.assertEqual(self.data, before)
        self.assertEqual(module.audit(self.config, self.data), report)

    def test_unmapped_new_node_blocks_release_without_dropping_product(self):
        self.data['products'].append(dict(id='new', categoryNodeId='new-node', visible=True))
        report = module.audit(self.config, self.data)
        self.assertFalse(report['releaseReady'])
        self.assertEqual(report['masterTotal'], 3)
        self.assertEqual(report['unmappedProductIds'], ['new'])

    def test_overlapping_subtrees_are_rejected(self):
        self.config['rules'].append(dict(nodeId='child', categoryId='shop-leaf', subtree=False))
        with self.assertRaisesRegex(ValueError, 'Overlapping'):
            module.audit(self.config, self.data)

    def test_unknown_product_override_is_not_silently_accepted(self):
        self.config['overrides'].append(dict(productId='unknown', categoryId='shop-leaf'))
        with self.assertRaisesRegex(ValueError, 'Unknown'):
            module.audit(self.config, self.data)

    def test_visibility_must_be_an_explicit_boolean(self):
        self.data['products'][0]['visible'] = 'false'
        with self.assertRaisesRegex(ValueError, 'visibility'):
            module.audit(self.config, self.data)


if __name__ == '__main__':
    unittest.main()
