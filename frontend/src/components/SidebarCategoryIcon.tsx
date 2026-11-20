import {AppstoreOutlined} from '@ant-design/icons';
import CategoryImage from './CategoryImage';
import type {BrowseFacet} from '../api';

/** Use the existing public-image guard and failure handling; art is operator supplied. */
export default function SidebarCategoryIcon({category}:{category:BrowseFacet}){
 return <span className="shopping-child-icon" aria-hidden="true"><CategoryImage src={category.imageUrl} className="shopping-child-art"/><AppstoreOutlined className="shopping-child-fallback"/></span>;
}
