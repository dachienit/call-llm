
// >>> EDIT THESE <<<
//const REPO_DIR   = "C:\\Users\\HGN4HC\\Desktop\\mcp-abap-abap-adt-api-main"; // absolute path is safest
let   class_Name;
let lockHandle;
let isError = false;
let mainTR;
let PackageUrl;
console.log("✅ createObject result:");

async function syntaxCheck(mcp, Code, URL, active){
/*********************************************************************/
/*====================Syntax Check=======================*/
/*********************************************************************/
let syntaxCheck ;
const sourceMain_Url = `${URL}/source/main`;
try{  
  syntaxCheck = await mcp.callTool('syntaxCheckCode',{
    code : Code,
    url : sourceMain_Url,
    mainUrl : sourceMain_Url
  })
} catch {
  syntaxCheck = await mcp.callTool('syntaxCheckCode',{
    code : Code,
    url : sourceMain_Url,
    mainUrl : sourceMain_Url
})
}
// console.dir(syntaxCheck,{depth:null});
/*********************************************************************/
/*==========================Unlock Object============================*/
/*********************************************************************/
let unlockClass;
try{
    unlockClass = await mcp.callTool("unLock",{
        objectUrl : sourceMain_Url,
        lockHandle: lockHandle,
    })
} catch {
        unlockClass = await mcp.callTool("unLock",{
        objectUrl : sourceMain_Url,
        lockHandle: lockHandle,
    })
}
 //console.log(sourceMain_Url);
// console.dir(unlockClass,{depth:null});
 const rawText_syntaxCheck = syntaxCheck?.content?.[0]?.text;
 if (rawText_syntaxCheck) {
  const parsed_syntaxCheck = JSON.parse(rawText_syntaxCheck);
  const innerText_syntaxCheck = JSON.parse(parsed_syntaxCheck?.content?.[0]?.text); 
  if(innerText_syntaxCheck){
      const syntaxCheck_result = innerText_syntaxCheck?.result;
      if(active){
//  console.log(syntaxCheck_result);
        if(!syntaxCheck_result.length){ 
/*********************************************************************/
/*==========================Active Class=============================*/
/*********************************************************************/
                let activateByName;
                try{
                        activateByName = await mcp.callTool("activateByName",{
                        objectName : class_Name,
                        objectUrl : sourceMain_Url,
                    })
                } catch {
                        activateByName = await mcp.callTool("activateByName",{
                        objectName : class_Name,
                        objectSourceUrl : sourceMain_Url,
                    })
                }
                const activate_status = activateByName?.content?.[0]?.text;
                console.dir(activateByName,{depth:null})
              }
              return syntaxCheck_result;
          }else return syntaxCheck_result;
        }else return '';
      }
}

async function setObjectSource(mcp, objectSourceUrl, Source, lockHandle, transport){

/*********************************************************************/
/*====================Included Code into Class=======================*/
/*********************************************************************/
let setObjectsource;
const setObjectsource_url = `${objectSourceUrl}/source/main`;
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
export async function createClassMain(mcp, className,parentName,description,sourceCode,active) {
/*********************************************************************/
/*==========================Create Class=============================*/
/*********************************************************************/
try{
/***************************Get Package URI **************************/
if (parentName !== '$TMP') {
let searchPackage;
  try{
    searchPackage = await mcp.callTool("searchObject",{
        query: parentName,
    });
  } catch {
    searchPackage = await mcp.callTool("searchObject",{
        query: parentName,
  });
 }
// console.dir(searchPackage, { depth: null });
 const PackagerawText = searchPackage?.content?.[0]?.text;
//Get the URI of package
if (PackagerawText) {
  const Pagparsed = JSON.parse(PackagerawText);
  const PaginnerText = JSON.parse(Pagparsed?.content?.[0]?.text);
  if(PaginnerText){
 //Get the TR number
   PackageUrl = PaginnerText.results?.[0]?.['adtcore:uri'];
  let TransportInfo;
   try{
    TransportInfo = await mcp.callTool("transportInfo",{
        objSourceUrl: PackageUrl,
    });
  } catch {
    TransportInfo = await mcp.callTool("transportInfo",{
        objSourceUrl: PackageUrl,
  });
 };
    const TransportInfoawText = TransportInfo?.content?.[0]?.text;
    if (TransportInfoawText) {
  const TransportInfouter = JSON.parse(TransportInfoawText);
  const innerText = TransportInfouter.content[0].text;
  const data = JSON.parse(innerText);
        mainTR = data.transportInfo.LOCKS.HEADER.TRKORR;  
  console.log(mainTR);   
    }
  }    
  }
};
   //Create Class
//console.log(PackageUrl);
  class_Name = className;
  let createClass;
  try {
    createClass = await mcp.callTool("createObject", {
      objtype: "CLAS/OC",
      name: className,
      parentName: parentName,
      description: description,
      parentPath: PackageUrl,
      transport: mainTR,
    });
  } catch {
    createClass = await mcp.callTool("createObject", {
         objtype: "CLAS/OC",
      name: className,
      parentName: parentName,
      description: description,
      parentPath: PackageUrl,
      transport: mainTR,
    });
  }
//    console.dir(createClass, { depth: null });
/*     console.log(`Class ${className} has been created.`);
    isError = !!createClass?.isError; */

/*********************************************************************/
/*==========================Lock Object==============================*/
/*********************************************************************/
//if ( isError !== true ){
  let lockObject;
  const class_name_lower = class_Name.toLowerCase();
  const objectUrl = `/sap/bc/adt/oo/classes/${class_name_lower}`;
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
  await setObjectSource(mcp,objectUrl,sourceCode,lockHandle,mainTR);
  const syntaxCheck_result = await syntaxCheck(mcp,sourceCode,objectUrl,active);
  const wrapped = {
    result: syntaxCheck_result
  };
  const syntaxCheck_jsonString = JSON.stringify(wrapped);
  return syntaxCheck_jsonString;
  }
}
//}

} catch (err) {
  console.error("❌ Error:", err?.message || err);
} finally {
}
}

