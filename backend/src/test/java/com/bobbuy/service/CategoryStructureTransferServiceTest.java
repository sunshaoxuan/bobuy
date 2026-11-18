package com.bobbuy.service;
import com.bobbuy.model.CategoryTreeNode;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class CategoryStructureTransferServiceTest {
 final CategoryTreeNodeRepository nodes=mock(CategoryTreeNodeRepository.class);
 final RecommendationImageRepository images=mock(RecommendationImageRepository.class);
 final CategoryStructureTransferService service=new CategoryStructureTransferService(nodes,images,new ObjectMapper());
 final List<CategoryTreeNode> tree=new ArrayList<>();
 CategoryStructureTransferServiceTest(){when(nodes.findAll()).thenAnswer(c->new ArrayList<>(tree));when(nodes.lockTree()).thenReturn(Optional.of(new CategoryTreeNode("system",null,Map.of(),List.of("system"),0,"UNCATEGORIZED")));when(nodes.saveAll(any())).thenAnswer(c->{tree.clear();((Iterable<CategoryTreeNode>)c.getArgument(0)).forEach(tree::add);return tree;});}
 byte[] csv(String rows){return ("id,parentId,ja-JP,zh-CN,zh-TW,en-US,sortOrder,imageUrl\r\n"+rows).getBytes(StandardCharsets.UTF_8);}
 @Test void previewNeverWritesAndConfirmedRoundTripIsIdempotent(){
  var bytes=csv("second,,Second,,,,2,\r\nfirst,,First,,,,0,\r\nchild,first,Child,,,,0,\r\n");var preview=service.preview(bytes);
  assertThat(preview.valid()).isTrue();verify(nodes,never()).saveAll(any());
  service.confirm(bytes,preview.revision(),preview.fileHash(),true);assertThat(tree).hasSize(3);
  assertThat(tree.stream().filter(n->n.getId().equals("child")).findFirst().orElseThrow().getFullPath()).containsExactly("first","child");
  clearInvocations(nodes);service.confirm(bytes,preview.revision(),preview.fileHash(),true);verify(nodes,never()).saveAll(any());
  byte[] exported=service.export(false);var roundTrip=service.preview(exported);assertThat(roundTrip.valid()).isTrue();service.confirm(exported,roundTrip.revision(),roundTrip.fileHash(),true);verify(nodes,never()).saveAll(any());
 }
 @Test void rejectsInvalidRowsCyclesDuplicateIdentitiesPrivateImageAndMissingConfirmation(){
  for(String rows:List.of("a,,A,,,,0,\r\na,,B,,,,1,\r\n","a,missing,A,,,,0,\r\n","a,b,A,,,,0,\r\nb,a,B,,,,1,\r\n","a,,A,,,,0,https://outside/image\r\n","a,,A,,,,-1,\r\n","a,,Same,,,,0,\r\nb,,Same,,,,1,\r\n")){
   var bytes=csv(rows);var p=service.preview(bytes);assertThat(p.valid()).isFalse();assertThatThrownBy(()->service.confirm(bytes,p.revision(),p.fileHash(),true)).isInstanceOf(IllegalArgumentException.class);
  }
  var good=csv("a,,A,,,,0,\r\n");var p=service.preview(good);assertThatThrownBy(()->service.confirm(good,p.revision(),p.fileHash(),false)).hasMessageContaining("Explicit confirmation");verify(nodes,never()).saveAll(any());
 }
 @Test void rejectsStaleTreeAndChangedFileBeforeAnyWrites(){
  var bytes=csv("a,,A,,,,0,\r\n");var p=service.preview(bytes);tree.add(new CategoryTreeNode("other",null,Map.of("ja-JP","Other"),List.of("other"),1,null));
  assertThatThrownBy(()->service.confirm(bytes,p.revision(),p.fileHash(),true)).hasMessageContaining("tree changed");
  assertThatThrownBy(()->service.confirm(csv("a,,Changed,,,,0,\r\n"),p.revision(),p.fileHash(),true)).hasMessageContaining("File changed");verify(nodes,never()).saveAll(any());
 }
}
