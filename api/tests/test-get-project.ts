import axios from 'axios';

// Test script to demonstrate get project functionality
async function testGetProject() {
  const baseUrl = 'http://localhost:3000';
  
  // Example project ID (replace with actual project ID from your batch)
  const projectId = 'd2a2e3fa-0562-4f5a-a13c-21f613212d26';

  try {
    console.log('🔍 Testing get project details...');
    console.log('Project ID:', projectId);

    // Method 1: Using the Submagic controller endpoint
    console.log('\n📋 Testing Submagic controller get project endpoint...');
    const response1 = await axios.get(`${baseUrl}/project/${projectId}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('✅ Submagic controller response:');
    console.log(JSON.stringify(response1.data, null, 2));

    // Method 2: Using the Project controller endpoint
    console.log('\n📋 Testing Project controller get project details endpoint...');
    const response2 = await axios.get(`${baseUrl}/project/${projectId}/details`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    console.log('✅ Project controller response:');
    console.log(JSON.stringify(response2.data, null, 2));

  } catch (error: any) {
    console.error('❌ Error getting project details:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('💡 Tip: Make sure the project ID exists and belongs to your account');
    } else if (error.response?.status === 401) {
      console.log('💡 Tip: Check your Submagic API key configuration');
    }
  }
}

// Test getting multiple projects
async function testGetMultipleProjects() {
  const baseUrl = 'http://localhost:3000';
  
  // Example project IDs (replace with actual project IDs)
  const projectIds = [
    'd2a2e3fa-0562-4f5a-a13c-21f613212d26',
    // Add more project IDs here to test multiple projects
  ];

  for (const projectId of projectIds) {
    try {
      console.log(`\n🔍 Getting details for project: ${projectId}`);
      
      const response = await axios.get(`${baseUrl}/project/${projectId}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      const project = response.data;
      console.log(`✅ Project: ${project.title || 'Untitled'}`);
      console.log(`   Status: ${project.status}`);
      console.log(`   Language: ${project.language}`);
      console.log(`   Template: ${project.templateName}`);
      console.log(`   Transcription: ${project.transcriptionStatus}`);
      
      if (project.videoMetaData) {
        console.log(`   Duration: ${project.videoMetaData.duration}s`);
        console.log(`   Resolution: ${project.videoMetaData.width}x${project.videoMetaData.height}`);
      }
      
      if (project.downloadUrl) {
        console.log(`   Download URL: ${project.downloadUrl}`);
      }
      
      // Wait a bit between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error(`❌ Error with project ${projectId}:`, error.response?.data || error.message);
    }
  }
}

// Instructions for usage
console.log(`
📋 Instructions for Get Project:
1. Start your NestJS server: npm run start:dev
2. Make sure you have valid project IDs from your Submagic account
3. Replace the example project ID with actual project IDs
4. Run this script: npx ts-node test-get-project.ts

🎯 Available Endpoints:
- GET /project/:projectId (Submagic controller)
- GET /project/:projectId/details (Project controller)

📝 Response Fields:
- id: Project UUID
- title: Project title
- language: Language code (e.g., "en")
- status: processing, transcribing, exporting, completed, failed
- transcriptionStatus: PROCESSING, COMPLETED, FAILED
- templateName: Applied template name
- magicZooms, magicBrolls: Boolean flags for AI features
- videoMetaData: width, height, duration, fps
- downloadUrl: Available when status is "completed"
- directUrl: Direct playback URL
- previewUrl: Submagic preview page URL
- words: Transcribed words array (when transcription completed)

⚠️ Prerequisites:
- Valid Submagic API key configured
- Project must exist in your Submagic account
- Project ID must be a valid UUID

🔍 Status Values:
- processing: Video is being processed
- transcribing: Audio is being transcribed
- exporting: Video is being rendered/exported
- completed: Project is ready with download links
- failed: Processing failed (check failureReason field)
`);

// Uncomment the lines below to run the tests
testGetProject();
// testGetMultipleProjects();