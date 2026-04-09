service ChatService @(impl: './chat-service.cjs', path: '/api') {

  type EnvSettings {
    brainId : String;
    ntid : String;
    customPrompt : String;
    theme : String;
  }

  type ChatResponse {
    reply : LargeString;
    hisID : String;
  }

  type UserInfo {
    username : String;
  }

  type SkillContent {
      content: LargeString;
  }

  action chat (
    message : LargeString,
    env : EnvSettings,
    option : String,
    reLoad : Boolean,
    objectType : String,
    objectName : String,
    error : LargeString,
    historyID : String
  ) returns ChatResponse;

  function userinfo() returns UserInfo;

  function skills() returns array of String;
  
  function getSkill(filename: String) returns SkillContent;
  
  action saveSkill(filename: String, content: LargeString) returns Boolean;
  


}
