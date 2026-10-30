'use client';
import {useState} from 'react';
export default function StudyImage({fileId,alt}:{fileId:string;alt:string}){
 const [failed,setFailed]=useState(false);
 if(failed)return <div className="notice"><p role="status">Não foi possível carregar a imagem. Confira se o arquivo ainda está nos Materiais e se você está conectado.</p><p>{alt}</p><button type="button" className="secondary" onClick={()=>setFailed(false)}>Tentar carregar novamente</button></div>;
 return <img className="study-image" src={'/api/lume/materials/files?id='+encodeURIComponent(fileId)+'&view=inline'} alt={alt} onError={()=>setFailed(true)} style={{maxWidth:'100%',maxHeight:400,objectFit:'contain'}}/>;
}
