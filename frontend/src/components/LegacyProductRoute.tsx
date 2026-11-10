import {Navigate,useLocation} from 'react-router-dom';
export default function LegacyProductRoute({deleted=false}:{deleted?:boolean}){
 const location=useLocation();const params=new URLSearchParams(location.search);if(deleted)params.set('view','deleted');
 return <Navigate replace to={{pathname:'/admin/products',search:params.toString()?`?${params}`:'',hash:location.hash}}/>;
}
