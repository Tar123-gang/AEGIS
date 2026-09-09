import {createHash,timingSafeEqual} from 'node:crypto';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const project='aegis-app-b6019';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const expected=Buffer.from('092e728c0113b034a616346616ef684a1ea1c569772173e68b1a89199547bfa9','hex');
const json=(status)=>new Response(JSON.stringify({allowed:status===200}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export default async function handler(req){
  if(req.method!=='POST')return json(405);
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return json(403);
  const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  if(!token)return json(401);
  try{
    const {payload}=await jwtVerify(token,keys,{algorithms:['RS256'],audience:project,issuer:'https://securetoken.google.com/'+project});
    if(!payload.sub) return json(401);
  }catch{return json(401);}
  try{
    const raw=await req.text();if(raw.length>1024)return json(413);
    const {password}=JSON.parse(raw);
    if(typeof password!=='string')return json(400);
    return json(timingSafeEqual(createHash('sha256').update(password).digest(),expected)?200:403);
  }catch{return json(400);}
}
export const config={path:'/api/sample-access',rateLimit:{windowLimit:5,windowSize:60,aggregateBy:['ip','domain']}};
