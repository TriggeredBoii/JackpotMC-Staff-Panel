import {describe,it,expect} from 'vitest';
import {randomToken,seal,unseal} from '../worker/security/crypto';
const secret='MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
describe('secure tokens',()=>{
  it('round trips encrypted state',async()=>{const token=await seal({hello:'world'},secret);expect(token).not.toContain('world');expect(await unseal(token,secret)).toEqual({hello:'world'});});
  it('rejects tampering',async()=>{const token=await seal({x:1},secret);expect(await unseal(token+'x',secret)).toBeNull();});
  it('creates unique random values',()=>expect(randomToken()).not.toBe(randomToken()));
});
