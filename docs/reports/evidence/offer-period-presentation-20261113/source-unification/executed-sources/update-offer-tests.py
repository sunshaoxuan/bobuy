from pathlib import Path
r=Path(__file__).parent
p=r/'frontend/src/components/offerPeriodText.ts';s=p.read_text(encoding='utf-8').replace('Date.parse(p.startsAt)','Date.parse(p.startsAt??\'\')');p.write_text(s,encoding='utf-8')
p=r/'backend/src/test/java/com/bobbuy/service/CustomerOrderAmendmentServiceTest.java';s=p.read_text(encoding='utf-8').replace('"quote-a",null,null,null,null)))','"quote-a",null,null,null,null,null)))').replace('null,null,null,null,"SYNTHETIC")','null,null,null,null,"SYNTHETIC",null)');p.write_text(s,encoding='utf-8')
p=r/'frontend/src/components/ProductMarkerBadges.test.tsx';s=p.read_text(encoding='utf-8').replace("import {storefrontApi,type PublicCatalogEntry} from '../api';","import {storefrontApi} from '../api';\nimport {selectedOfferSource} from './selectedOfferSource';\nimport type {StoreProduct} from '../api';")
a=s.index('const detailEntry=');b=s.index('afterEach',a);s=s[:a]+s[b:]
a=s.index("it('loads dates only");s=s[:a]+'''it('uses the selected quote only and never fetches another price source on open',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T00:00:00Z'));
 const load=vi.spyOn(storefrontApi,'productDetail');
 const source=promotion();const quote={priceChange:{...promotion({documentId:8,startsAt:'2026-11-12T15:00:00Z',endsAt:'2026-11-13T15:00:00Z'})}} as unknown as StoreProduct;
 expect(selectedOfferSource(quote,false,source)).toEqual([quote.priceChange]);
 expect(selectedOfferSource(quote,true,source)).toEqual([source]);
 expect(selectedOfferSource({...quote,priceChange:null},false,source)).toEqual([]);
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} overlay promotionPrices={selectedOfferSource(quote,false,source)}/></I18nProvider>);
 const badge=screen.getByLabelText('discount');fireEvent.focus(badge);await screen.findByText('Nov 13');expect(screen.queryByText('Nov 2 to Nov 15')).toBeNull();
 fireEvent.click(badge);await waitFor(()=>expect(screen.getByRole('tooltip')).toBeVisible());expect(document.querySelector('.offer-period-tooltip')).toHaveClass('ant-tooltip-placement-rightTop');expect(load).not.toHaveBeenCalled();view.unmount();
});
it('rechecks the selected document end when reopened without another read',async()=>{
 const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T01:00:00Z'));
 render(<I18nProvider><ProductMarkerBadges markers={[discount]} overlay promotionPrices={[promotion({endsAt:'2026-11-13T02:00:00Z'})]}/></I18nProvider>);
 const badge=screen.getByLabelText('discount');fireEvent.focus(badge);await screen.findByText(/11:00/);fireEvent.blur(badge);await waitFor(()=>expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());clock.mockReturnValue(Date.parse('2026-11-13T02:00:00Z'));fireEvent.focus(badge);await screen.findByText('Offer dates to be confirmed');
});
''';p.write_text(s,encoding='utf-8')
p=r/'frontend/src/components/PriceAdjustmentWorkspace.test.tsx';s=p.read_text(encoding='utf-8');a=s.index(' const select=');b=s.index(' fireEvent.change',a);s=s[:a]+" expect(within(drawer).getByRole('heading',{name:'001 · Synthetic one'})).toBeVisible();expect(within(drawer).queryByRole('listbox',{name:'Select products, multiple allowed'})).toBeNull();\n"+s[b:];p.write_text(s,encoding='utf-8')
p=r/'backend/src/test/java/com/bobbuy/api/ProductPricingIntegrationTest.java';s=p.read_text(encoding='utf-8');a='  assertThat(quote(start).priceToken())';i=s.index(a);s=s[:i]+'''  var source=quote(start).priceChange();assertThat(source.documentId()).isEqualTo(row.get("id").asLong());assertThat(source.type()).isEqualTo("PROMOTION");assertThat(source.promotion()).isTrue();assertThat(source.startsAt()).isEqualTo(start);assertThat(source.endsAt()).isEqualTo(end);assertThat(quote(end).priceChange()).isNull();
'''+s[i:];p.write_text(s,encoding='utf-8')
p=r/'backend/src/test/java/com/bobbuy/service/PublicProductBrowseServiceTest.java';s=p.read_text(encoding='utf-8');i=s.index(' private static class Catalog');s=s[:i]+''' @Test void cardCarriesOnlyItsSelectedPriceDocumentPeriod(){
  var base=row(0,null);var start=java.time.Instant.now().minusSeconds(3600);var end=start.plusSeconds(7200);
  var selected=new ReferenceQuoteService.CurrentPrice(42L,"PC-WAREHOUSE","COSTCO_WAREHOUSE","JPY","pack",new java.math.BigDecimal("800"),new java.math.BigDecimal("1000"),true,start,end,"PROMOTION","ACTIVE");
  var other=new ReferenceQuoteService.CurrentPrice(43L,"PC-ONLINE","COSTCO_ONLINE","JPY","pack",new java.math.BigDecimal("700"),new java.math.BigDecimal("1200"),true,start.minusSeconds(86400),end.plusSeconds(86400),"PROMOTION","ACTIVE");
  catalog.rows=List.of(new PublicProductCatalogService.Entry(base.productId(),base.merchantId(),base.name(),base.description(),base.brand(),base.itemNumber(),base.specification(),base.model(),base.packaging(),base.gallery(),base.categories(),List.of(),false,null,Map.of(),List.of(selected,other)));
  var card=service.browse(0,null,"","","en-US",false,null).items().get(0);assertThat(card.reference().amount()).isEqualByComparingTo("800");var source=card.reference().priceChange();assertThat(source.documentId()).isEqualTo(42L);assertThat(source.startsAt()).isEqualTo(start);assertThat(source.endsAt()).isEqualTo(end);assertThat(source.effectiveAmount()).isEqualByComparingTo(card.reference().amount());
 }
'''+s[i:];p.write_text(s,encoding='utf-8')
