// CSS Supabase browser client. Public key is safe only when RLS is enabled.
// Load after supabase-js UMD script. Do not put service-role keys here.
(function () {
  "use strict";
  const PROJECT_URL = "https://ydlrbhvbxnryqtuzgxfc.supabase.co";
  let client = null;
  function configure(publishableKey) {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      throw new Error("supabase-js library must be loaded first");
    }
    if (!publishableKey || typeof publishableKey !== "string") {
      throw new Error("Missing Supabase publishable key");
    }
    client = window.supabase.createClient(PROJECT_URL, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return client;
  }
  function getClient() {
    if (!client) throw new Error("Call CSSCloud.configure() first");
    return client;
  }
  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    const member = await currentMember();
    if (!member || !member.active) {
      await getClient().auth.signOut();
      throw new Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน CSS");
    }
    return data;
  }
  async function currentMember() {
    const { data: session, error: authError } = await getClient().auth.getUser();
    if (authError || !session.user) return null;
    const { data, error } = await getClient().from("css_members")
      .select("user_id,role,active").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function requireMember() {
    const member = await currentMember();
    if (!member || !member.active) throw new Error("กรุณาเข้าสู่ระบบด้วยบัญชีที่ได้รับอนุมัติ");
    return member;
  }
  async function loadJobs() {
    await requireMember();
    const jobs = [];
    let from = 0;
    while (true) {
      const { data, error } = await getClient().from("css_jobs")
        .select("job_id,job_data").order("job_id", { ascending: true }).range(from, from + 499);
      if (error) throw error;
      jobs.push(...data.map(row => row.job_data));
      if (data.length < 500) break;
      from += 500;
    }
    return jobs;
  }
  async function loadSurveys() {
    await requireMember();
    const surveys = [];
    let from = 0;
    while (true) {
      const { data, error } = await getClient().from("surveys")
        .select("id,saved_at,job_id,team,status,average,comment,evaluator,callback,answers_json")
        .order("id", { ascending: false }).range(from, from + 499);
      if (error) throw error;
      surveys.push(...data.map(row => ({
        ...row,
        answers_json: row.answers_json == null ? null : JSON.stringify(row.answers_json)
      })));
      if (data.length < 500) break;
      from += 500;
    }
    return surveys;
  }
  async function saveSurvey(record) {
    const member = await requireMember();
    const { data: userInfo, error: userError } = await getClient().auth.getUser();
    if (userError || !userInfo.user) throw new Error("Session expired");
    const jobId = String(record.job_id || "").trim();
    if (!jobId) throw new Error("ต้องระบุ JOB ID");
    const { data: existingJob, error: jobError } = await getClient()
      .from("css_jobs").select("job_id").eq("job_id", jobId).maybeSingle();
    if (jobError) throw jobError;
    if (!existingJob) throw new Error("ไม่พบ JOB นี้ใน Cloud กรุณาซิงก์ JOB ก่อนบันทึกผลประเมิน");
    const { data, error } = await getClient().from("surveys").insert({
      job_id: jobId,
      team: record.team || null,
      status: record.status,
      average: record.average == null ? null : Number(record.average),
      comment: record.comment || null,
      evaluator: record.evaluator || null,
      callback: record.callback || null,
      answers_json: record.answers || null,
      created_by: userInfo.user.id
    }).select("id").single();
    if (error) throw error;
    return data;
  }
  async function loadQuestions() {
    await requireMember();
    const { data, error } = await getClient().from("survey_questions")
      .select("team,questions_json");
    if (error) throw error;
    return Object.fromEntries(data.map(row => [row.team, row.questions_json]));
  }
  async function signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
  }
  window.CSSCloud = Object.freeze({
    configure, getClient, signIn, signOut, currentMember, requireMember,
    loadJobs, loadSurveys, saveSurvey, loadQuestions
  });
})();
