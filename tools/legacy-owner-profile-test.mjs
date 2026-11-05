// Retain the classic owner-profile regression entry against the complete shared implementation.
import {spawnSync} from 'node:child_process'
const result=spawnSync(process.execPath,['tools/v3-profile-test.mjs'],{stdio:'inherit',env:{...process.env,FP_PROFILE_MODE:'v1'}})
if(result.error)throw result.error
process.exitCode=result.status??1
