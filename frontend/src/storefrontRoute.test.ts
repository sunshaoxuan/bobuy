import {hiddenTripDestination} from './storefrontRoute';
it.each(['/trips','/client/trips'])('sends hidden %s URLs to the catalog while retaining valid node scope',()=>{
  expect(hiddenTripDestination('?node=7&query=ignored')).toBe('/products?node=7');
  expect(hiddenTripDestination('')).toBe('/products');
});
