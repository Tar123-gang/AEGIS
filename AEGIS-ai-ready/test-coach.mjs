import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
const {publicKey,privateKey}=await generateKeyPair('RS256');
const jwk=await exportJWK(publicKey);jwk.kid='test';
let calls=0;
globalThis.fetch=async (url,options)=>{
  if(String(url).includes('googleapis.com/service_accounts'))return Response.json({keys:[jwk]});
  calls++;assert.equal(options.headers['x-goog-api-key'],'test-only');
  const body=JSON.parse(options.body);assert.equal(body.contents.at(-1).parts[0].text,'Bantu fokus');
  return Response.json({candidates:[{content:{parts:[{text:'Mulai dengan fokus 10 menit.'}]}}]});
};
const {default:handler}=await import('./netlify/functions/coach.mjs');
const token=await new SignJWT({}).setProtectedHeader({alg:'RS256',kid:'test'}).setSubject('user1').setIssuer('https://securetoken.google.com/aegis-app-b6019').setAudience('aegis-app-b6019').setIssuedAt().setExpirationTime('1h').sign(privateKey);
function request(body,auth=token){return new Request('https://aegis-project-team.netlify.app/api/coach',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify(body)});}
assert.equal((await handler(new Request('https://example.com/api/coach'))).status,405);
assert.equal((await handler(request({message:'Bantu fokus'},'invalid'))).status,401);
assert.equal((await handler(request({message:''}))).status,400);
assert.equal((await handler(request({message:'Bantu fokus'}))).status,503);
process.env.GEMINI_API_KEY='test-only';
const res=await handler(request({message:'Bantu fokus',history:[]}));
assert.equal(res.status,200);assert.equal((await res.json()).reply,'Mulai dengan fokus 10 menit.');assert.equal(calls,1);
console.log('PASS: method, invalid login, invalid input, missing key and authenticated AI reply (mocked provider).');
