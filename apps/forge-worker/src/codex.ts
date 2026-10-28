import {Codex} from '@openai/codex-sdk';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SYSTEM_PROMPT,blueprintJsonSchema,moderate,type ForgeProvider} from './pipeline.js';
export class CodexForgeProvider implements ForgeProvider {
 readonly name='codex-sdk';
 async generateUnit(idea:string,signal:AbortSignal){
  if(process.env.CODEX_ISOLATED!=='true')throw new Error('Codex runtime disabled: an operator must verify container isolation first.');
  moderate(idea);const dir=await mkdtemp(join(tmpdir(),'patch-forge-'));
  try{const codex=new Codex({apiKey:process.env.OPENAI_API_KEY,env:{PATH:process.env.PATH??'',HOME:dir,USERPROFILE:dir,CODEX_HOME:dir,...(process.env.SYSTEMROOT?{SYSTEMROOT:process.env.SYSTEMROOT}:{})}});const thread=codex.startThread({workingDirectory:dir,skipGitRepoCheck:true,sandboxMode:'read-only',approvalPolicy:'never',networkAccessEnabled:false,webSearchEnabled:false});const result=await thread.run(SYSTEM_PROMPT+'\nUntrusted concept: '+JSON.stringify(idea),{signal,outputSchema:blueprintJsonSchema()});if(result.items.some(i=>['command_execution','mcp_tool_call','web_search','file_change'].includes(i.type)))throw new Error('Provider attempted a prohibited tool operation.');if(result.finalResponse.length>10000)throw new Error('Generated output is too large.');return JSON.parse(result.finalResponse);}finally{await rm(dir,{recursive:true,force:true});}
 }
}
