export function RecommendationName({text}:{text:{primaryName:string;originalName?:string}}){
 return <><span className="rec-name-local">{text.primaryName}</span>{text.originalName&&<span className="rec-name-original" lang="ja">（{text.originalName}）</span>}</>;
}
