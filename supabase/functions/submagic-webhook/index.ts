
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  const execution_id = crypto.randomUUID();
  console.log(`[${execution_id}] Webhook execution started`);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (req.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const payload = await req.json();
    console.log(`[${execution_id}] Received webhook payload:`, JSON.stringify(payload));

    const {
      projectId,
      id,
      status,
      title,
      downloadUrl,
      directUrl,
      duration,
      completedAt,
      previewUrl
    } = payload;

    const targetProjectId = projectId || id;

    if (!targetProjectId) {
      console.error(`[${execution_id}] No project ID found in payload`);
      return new Response(JSON.stringify({ error: "No project ID found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${execution_id}] Processing project ${targetProjectId} with status ${status}`);

    // 1. User Media Items Update (New Requirement)
    // Query user_media_items to retrieve associated record
    const { data: userMediaItem, error: mediaFetchError } = await supabaseClient
      .from("user_media_items")
      .select("*")
      .single();

    if (mediaFetchError && mediaFetchError.code !== 'PGRST116') { // PGRST116 is 'not found'
       console.error(`[${execution_id}] Error fetching user media item:`, mediaFetchError);
       // We don't throw here to allow projects/jobs update to proceed if media item is just missing
    }

    if (userMediaItem) {
      // Idempotency check
      if (userMediaItem.completed_at) {
        console.log(`[${execution_id}] User media item ${targetProjectId} already completed at ${userMediaItem.completed_at}. Skipping update.`);
      } else {
        const updateData = {
          status: status || 'completed',
          download_url: downloadUrl,
          direct_url: directUrl,
          preview_url: previewUrl,
          completed_at: completedAt || new Date().toISOString(),
          // Merge metadata if needed, but we mostly just update columns
        };

        const { error: mediaUpdateError } = await supabaseClient
          .from("user_media_items")
          .update(updateData)
          .eq("id", targetProjectId);

        if (mediaUpdateError) {
          console.error(`[${execution_id}] Error updating user media item:`, mediaUpdateError);
          throw mediaUpdateError;
        }
        console.log(`[${execution_id}] Successfully updated user media item ${targetProjectId}`);
      }
    } else {
      console.warn(`[${execution_id}] User media item not found for project ${targetProjectId}. Proceeding with project/job updates.`);
    }

    // 2. Process Webhook Logic (Jobs & Projects) - Preserving existing architecture
    const completionData = {
      projectId: targetProjectId,
      status: status || "completed",
      downloadUrl: downloadUrl || payload.videoUrl || payload.output,
      receivedAt: new Date().toISOString(),
      raw: payload
    };

    // Update 'jobs' table
    const { data: jobs, error: searchError } = await supabaseClient
      .from("jobs")
      .select("*")
      .contains("parameters", { projectId: targetProjectId })
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError) {
       console.error(`[${execution_id}] Error searching for job:`, searchError);
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      const jobUpdateData = {
        status: completionData.status === 'success' ? 'completed' : completionData.status,
        result: completionData,
        completed_at: new Date().toISOString(),
        error_logs: payload.error || null
      };

      const { error: updateJobError } = await supabaseClient
        .from("jobs")
        .update(jobUpdateData)
        .eq("id", job.id);

      if (updateJobError) {
        console.error(`[${execution_id}] Error updating job:`, updateJobError);
      } else {
        console.log(`[${execution_id}] Updated job ${job.id}`);
      }
    }

    // Update 'projects' table (Triggers Media Matching via Realtime)
    const { data: project, error: projectFetchError } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("id", targetProjectId)
      .single();

    if (projectFetchError && projectFetchError.code !== 'PGRST116') {
       console.error(`[${execution_id}] Error fetching project:`, projectFetchError);
    }

    if (project) {
       const currentMetadata = project.metadata || {};
       const newMetadata = {
        ...currentMetadata,
        result: completionData,
        error: payload.error || null,
        completedAt: completionData.receivedAt,
        uploadStatus: 'completed'
      };

      let finalStatus = completionData.status;
      if (finalStatus === 'success') finalStatus = 'completed';
      if (finalStatus === 'error') finalStatus = 'failed';

      const { error: projectUpdateError } = await supabaseClient
        .from("projects")
        .update({
          status: finalStatus,
          updated_at: new Date().toISOString(),
          metadata: newMetadata
        })
        .eq("id", targetProjectId);

      if (projectUpdateError) {
        console.error(`[${execution_id}] Error updating project:`, projectUpdateError);
        throw projectUpdateError;
      }
      console.log(`[${execution_id}] Successfully updated project ${targetProjectId}`);
    } else {
       if (!userMediaItem) {
          // If neither found, return 404? Or just 200 to stop retries?
          // Usually 200 if we can't do anything about it.
          console.warn(`[${execution_id}] Neither Project nor User Media Item found for ID ${targetProjectId}`);
       }
    }

    return new Response(JSON.stringify({ 
      message: "Webhook processed successfully", 
      projectId: targetProjectId,
      execution_id 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${execution_id}] Unexpected error:`, error);
    return new Response(JSON.stringify({ error: error.message, execution_id }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
