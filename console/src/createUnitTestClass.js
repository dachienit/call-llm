// Minimal: just create an ABAP class (CLAS/OC) via MCP and print the result.
// >>> EDIT THESE <<<
let   class_Name;
let lockHandle;
console.log("✅ createObject result:");

async function activateUnittest(mcp, URL){
/*********************************************************************/
/*==========================Unlock Object============================*/
/*********************************************************************/
const unitText_Url = URL ;
let unlockClass;
try{
    unlockClass = await mcp.callTool("unLock",{
        objectUrl : unitText_Url,
        lockHandle: lockHandle,
    })
} catch {
        unlockClass = await mcp.callTool("unLock",{
        objectUrl : unitText_Url,
        lockHandle: lockHandle,
    })
}

let activateByName;
try{
        activateByName = await mcp.callTool("activateByName",{
        objectName : class_Name,
        objectUrl : unitText_Url,
    })
} catch {
        activateByName = await mcp.callTool("activateByName",{
        objectName : class_Name,
        objectSourceUrl : unitText_Url,
    })
}
console.dir(activateByName,{depth:null})
}
  


async function setObjectSource(mcp, objectSourceUrl, Source, lockHandle, transport){
/*********************************************************************/
/*====================Included Code into Class=======================*/
/*********************************************************************/
let setObjectsource;
const setObjectsource_url = `${objectSourceUrl}/includes/testclasses`;
try{
    setObjectsource = await mcp.callTool("setObjectSource",{
        objectSourceUrl : setObjectsource_url,
        source:Source,
        lockHandle: lockHandle,
        transport: transport,
    })
} catch {
        setObjectsource = await mcp.callTool("setObjectSource",{
        objectSourceUrl : setObjectsource_url,
        source:sourceCode,
        lockHandle: lockHandle,
        transport: transport,
    })
}
//    console.dir(setObjectsource,{depth:null});
}

/*********************************************************************/
/*===========================Main flow===============================*/
/*********************************************************************/
export async function createUnitText(mcp, className,sourceCode,transport) {
try {
/***************************Get class URI **************************/
let searchClass;
  class_Name = className;
  try{
    searchClass = await mcp.callTool("searchObject",{
        query: className,
    })
  } catch {
    searchClass = await mcp.callTool("searchObject",{
        query: className,
  });
 }
// console.dir(searchClass, { depth: null });
 const ClassrawText = searchClass?.content?.[0]?.text;
//Get the URI of package
if (ClassrawText) {
  const Pagparsed = JSON.parse(ClassrawText);
  const PaginnerText = JSON.parse(Pagparsed?.content?.[0]?.text);
  if(PaginnerText){
  const ClassUrl = PaginnerText.results?.[0]?.['adtcore:uri'];
/*********************************************************************/
/*==========================Lock Object==============================*/
/*********************************************************************/
  let lockObject;
  const objectUrl = ClassUrl;
  try{
    lockObject = await mcp.callTool("lock",{
        objectUrl : objectUrl,
    });
  } catch{
    lockObject = await mcp.callTool("lock",{
        objectUrl : objectUrl,
    });
  }
 // console.dir(lockObject,{ depth:null});
  const rawText = lockObject?.content?.[0]?.text;
//Get the Lock Object handle
if (rawText) {
  const parsed = JSON.parse(rawText);
  const innerText = JSON.parse(parsed?.content?.[0]?.text);
  if(innerText){
  lockHandle = innerText?.lockHandle;
  let createTestinclude;
  try {
  createTestinclude  = mcp.callTool('createTestInclude', {
    clas : className,
    lockHandle : lockHandle,
    transport : transport,
  })
  } catch{
    createTestinclude  = mcp.callTool('createTestInclude', {
    clas : className,
    lockHandle : lockHandle,
    transport : transport,
  })
  }
  await setObjectSource(mcp,objectUrl,sourceCode,lockHandle,transport);
  await activateUnittest(mcp,objectUrl);
  }
}
}
}
} catch (err) {
  console.error("❌ Error:", err?.message || err);
} finally {
  
}
}
