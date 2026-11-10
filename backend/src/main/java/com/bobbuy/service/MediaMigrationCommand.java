package com.bobbuy.service;

import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import javax.sql.DataSource;
import java.nio.file.Path;
import java.util.*;

/** Boot-jar PropertiesLauncher entry point. Dry run is default and creates no Spring/Flyway context.
 * Reads PG only; outputs metadata/checkpoints only, never a local-file product/image importer. */
public final class MediaMigrationCommand {
 private static String env(String name,String fallback){String value=System.getenv(name);return value==null?fallback:value;}
 public static void main(String[] args){int exit=2;try{var result=execute(args);System.out.println("MEDIA_MIGRATION "+result.status()+" rows="+result.audit().mediaRows()+" verified="+result.audit().verifiedRows()+" pgRetainedRows="+result.audit().pgRetainedRows()+" objectOnlyRows="+result.audit().objectOnlyRows()+" existingPGBytesNotDeleted=true");exit=result.status().equals("INCOMPLETE")?3:0;}catch(Exception failure){System.err.println("Media migration stopped: "+failure.getClass().getSimpleName()+". No completion or deletion claimed.");}System.exit(exit);}
 public static MediaMigrationExecutor.Result execute(String[] args)throws Exception{
  var values=new HashMap<String,String>();var mode=MediaMigrationExecutor.Mode.DRY_RUN;boolean chosen=false;
  for(String arg:args){if(Set.of("--dry-run","--apply","--verify").contains(arg)){if(chosen)throw new IllegalArgumentException("Choose one migration mode");chosen=true;mode=arg.equals("--apply")?MediaMigrationExecutor.Mode.TRANSFER:arg.equals("--verify")?MediaMigrationExecutor.Mode.VERIFY:MediaMigrationExecutor.Mode.DRY_RUN;}else{int equals=arg.indexOf('=');if(equals<3||!Set.of("--report","--checkpoint","--batch","--max-pages","--max-transfers","--workers","--seconds").contains(arg.substring(0,equals))||values.put(arg.substring(0,equals),arg.substring(equals+1))!=null)throw new IllegalArgumentException("Unknown or duplicate migration option");}}
  String endpoint=env("BOBBUY_MEDIA_RUSTFS_ENDPOINT",""),bucket=env("BOBBUY_MEDIA_RUSTFS_BUCKET","bobuy-media");String target=MediaBinaryService.sha((endpoint+"|"+bucket).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  var options=new MediaMigrationExecutor.Options(mode,values.containsKey("--checkpoint")?Path.of(values.get("--checkpoint")):null,Path.of(Objects.requireNonNull(values.get("--report"),"Report path is required")),number(values,"--batch",50),number(values,"--max-pages",1000),number(values,"--max-transfers",10000),number(values,"--workers",2),number(values,"--seconds",300),target);
  DataSource source=source();
  if(mode==MediaMigrationExecutor.Mode.DRY_RUN)return new MediaMigrationExecutor(source,null,null,null).run(options);
  if(mode==MediaMigrationExecutor.Mode.VERIFY){try(var store=objectStore()){return new MediaMigrationExecutor(source,null,null,store).run(options);}}
  // Refuse schema changes. Applying additive V21/V22 is a separate reviewed deployment step.
  try(var c=source.getConnection();var s=c.createStatement();var r=s.executeQuery("select count(*) from flyway_schema_history where success and version in ('21','22')")){if(!r.next()||r.getInt(1)!=2)throw new IllegalStateException("Already applied V21/V22 schema is required");}
  try(var context=new AnnotationConfigApplicationContext()){
   context.getEnvironment().setActiveProfiles("media-migration-command");
   context.registerBean(DataSource.class,()->source);context.register(Configuration.class);context.refresh();return context.getBean(MediaMigrationExecutor.class).run(options);
  }
 }
 private static int number(Map<String,String> values,String name,int fallback){return Integer.parseInt(values.getOrDefault(name,String.valueOf(fallback)));}
 private static DataSource source(){String url=env("SPRING_DATASOURCE_URL","");if(!url.startsWith("jdbc:postgresql://")||url.toLowerCase(Locale.ROOT).contains("password=")||url.contains("@"))throw new IllegalArgumentException("Explicit PostgreSQL URL without embedded credentials is required");var data=new DriverManagerDataSource(url,env("SPRING_DATASOURCE_USERNAME",""),env("SPRING_DATASOURCE_PASSWORD",""));data.setDriverClassName("org.postgresql.Driver");var properties=new Properties();properties.setProperty("connectTimeout","3");properties.setProperty("socketTimeout","30");properties.setProperty("ApplicationName","bobuy-media-migration");properties.setProperty("options","-c statement_timeout=30000 -c lock_timeout=5000");data.setConnectionProperties(properties);return data;}
 private static RustFsObjectStore objectStore(){if(!Boolean.parseBoolean(env("BOBBUY_MEDIA_RUSTFS_ENABLED","false")))throw new IllegalStateException("Explicit object storage activation is required");return new RustFsObjectStore(true,env("BOBBUY_MEDIA_RUSTFS_ENDPOINT",""),env("BOBBUY_MEDIA_RUSTFS_BUCKET","bobuy-media"),env("BOBBUY_MEDIA_RUSTFS_ACCESS_KEY_FILE",""),env("BOBBUY_MEDIA_RUSTFS_SECRET_KEY_FILE",""),env("BOBBUY_MEDIA_RUSTFS_CA_FILE",""));}
 @org.springframework.context.annotation.Configuration
 @Profile("media-migration-command")
 @EnableJpaRepositories(basePackages="com.bobbuy.repository")
 @EnableTransactionManagement
 @Import({MediaBinaryService.class,MediaReferenceCatalog.class,MediaTransferWorker.class,MediaMigrationExecutor.class})
 static class Configuration {
  @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource source){var factory=new LocalContainerEntityManagerFactoryBean();factory.setDataSource(source);factory.setPackagesToScan("com.bobbuy.model");factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","validate","hibernate.physical_naming_strategy","org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy","hibernate.implicit_naming_strategy","org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy"));return factory;}
  @Bean org.springframework.transaction.PlatformTransactionManager transactionManager(jakarta.persistence.EntityManagerFactory factory){return new JpaTransactionManager(factory);}
  @Bean MediaObjectStore objectStore(){return MediaMigrationCommand.objectStore();}
 }
}
