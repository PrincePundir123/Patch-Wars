import {describe,it,expect} from 'vitest';
import {createGame,startGame,step,spawn,SLIME,MAX_ENTITIES} from '../packages/game-core/src/index.js';
describe('deterministic battle',()=>{
 it('reproduces movement, combat and final result from seed',()=>{const run=()=>{const s=createGame(42,60);startGame(s);for(let i=0;i<1200;i++)step(s);return s;};const a=run();expect(a).toEqual(run());expect(a.phase).toBe('results');expect(a.damage.ember+a.damage.azure).toBeGreaterThan(0);expect(a.scores.ember+a.scores.azure).toBeGreaterThan(0);});
 it('splits once and never recursively',()=>{const s=createGame();s.phase='battle';s.catalog[SLIME.id]=SLIME;spawn(s,'ember',SLIME.id,true);s.units[0]!.hp=0;step(s,false);expect(s.units).toHaveLength(3);expect(s.units.every(u=>u.child)).toBe(true);for(const u of s.units)u.hp=0;step(s,false);expect(s.units).toHaveLength(0);});
 it('enforces costs and entity budget',()=>{const s=createGame();s.energy.ember=0;expect(spawn(s,'ember','guardian')).toBe(false);for(let i=0;i<300;i++)spawn(s,'ember','guardian',true);expect(s.units).toHaveLength(MAX_ENTITIES);});
 it('heals and shields within limits',()=>{const s=createGame();s.phase='battle';spawn(s,'ember','healer',true);spawn(s,'ember','guardian',true);s.units[1]!.x=s.units[0]!.x;s.units[1]!.y=s.units[0]!.y;s.units[1]!.hp=40;s.tick=29;step(s,false);expect(s.units[1]!.hp).toBe(48);});
 it('finishes a tie without nondeterministic coin flips',()=>{const s=createGame(1,1);s.phase='battle';for(let i=0;i<20;i++)step(s,false);expect(s.winner).toBe('draw');});
});
