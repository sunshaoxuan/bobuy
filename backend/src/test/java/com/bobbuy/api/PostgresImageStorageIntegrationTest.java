package com.bobbuy.api;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import java.util.*;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest @AutoConfigureMockMvc
class PostgresImageStorageIntegrationTest {
 @Autowired ImageStorageService storage;@Autowired RecommendationImageRepository images;
 @Autowired UserRepository users;@Autowired JwtTokenService tokens;@Autowired MockMvc mvc;
 String owner,other,customer;String data;byte[] png;Set<String> created=new HashSet<>();
 @BeforeEach void setup() throws Exception {
  owner=user(918070L,Role.AGENT);other=user(918071L,Role.AGENT);customer=user(918072L,Role.CUSTOMER);
  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("918070",null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
  var image=new BufferedImage(3,2,BufferedImage.TYPE_INT_RGB);image.setRGB(0,0,0x112233);
  var out=new ByteArrayOutputStream();ImageIO.write(image,"png",out);png=out.toByteArray();data="data:image/png;base64,"+Base64.getEncoder().encodeToString(png);
 }
 String user(long id,Role role){var u=new User(id,"media-test-"+id,role,0);users.save(u);return tokens.createAccessToken(u);}
 @AfterEach void cleanup(){SecurityContextHolder.clearContext();created.forEach(images::deleteById);for(long id:List.of(918070L,918071L,918072L))users.deleteById(id);}
 String remember(String key){String id=key.substring(key.lastIndexOf(':')+1);created.add(id);return id;}
 @Test void storesDeduplicatedValidatedPrivateBytesAndProtectsBothImageRoutes() throws Exception {
  var a=storage.saveBase64ToObject(data);String id=remember(a.objectKey());
  var b=storage.saveBase64ToObject(data);assertThat(b).isEqualTo(a);
  var row=images.findById(id).orElseThrow();assertThat(row.accessScope).isEqualTo("PRIVATE");assertThat(row.merchantId).isEqualTo(918070L);
  assertThat(ImageIO.read(new java.io.ByteArrayInputStream(row.content)).getRGB(0,0)&0xffffff).isEqualTo(0x112233);
  assertThat(storage.generatePreviewUrl(a.objectKey())).isEqualTo(a.publicUrl());
  mvc.perform(get(a.publicUrl()).header("Authorization","Bearer "+owner)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store")).andExpect(content().contentType("image/png")).andExpect(content().bytes(row.content));
  mvc.perform(get(a.publicUrl()).header("Authorization","Bearer "+other)).andExpect(status().isNotFound());
  mvc.perform(get(a.publicUrl()).header("Authorization","Bearer "+customer)).andExpect(status().isForbidden());
  mvc.perform(get(a.publicUrl())).andExpect(status().isForbidden());
  mvc.perform(get("/api/storefront/recommendation-images/"+id)).andExpect(status().isNotFound());
 }
 @Test void publicCatalogPhotoAndPrivateReceiptNeverShareAnAccessIdentity() throws Exception {
  var privateImage=storage.saveBase64ToObject(data);String privateId=remember(privateImage.objectKey());
  String publicUrl=storage.saveBase64(data);String publicId=publicUrl.substring(publicUrl.lastIndexOf('/')+1);created.add(publicId);
  assertThat(publicId).isNotEqualTo(privateId);
  mvc.perform(get(publicUrl)).andExpect(status().isOk()).andExpect(content().contentType("image/png"));
  mvc.perform(get("/api/merchant/media/"+publicId).header("Authorization","Bearer "+owner)).andExpect(status().isNotFound());
 }
 @Test void rejectsMalformedOversizedOrNonImagePayloadsAndMissingMerchantIdentity() {
  for(String invalid:List.of("not-base64","data:image/svg+xml;base64,PHN2Zz4=",Base64.getEncoder().encodeToString("not an image".getBytes()),"A".repeat(12_000_000)))
   assertThatThrownBy(()->storage.saveBase64ToObject(invalid)).isInstanceOf(com.bobbuy.api.response.ApiException.class);
  assertThat(storage.saveBase64ToObject(null)).isNull();assertThat(storage.generatePreviewUrl("legacy-object.jpg")).isNull();
  SecurityContextHolder.clearContext();assertThatThrownBy(()->storage.saveBase64ToObject(data)).isInstanceOf(com.bobbuy.api.response.ApiException.class);
 }
}
