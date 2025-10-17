import axios from 'axios';

// Test script to demonstrate project export functionality
async function testExportProject() {
  const baseUrl = 'http://localhost:3000';
  
  // Example project ID (replace with actual project ID from your batch)
  const projectId = 'd2a2e3fa-0562-4f5a-a13c-21f613212d26';
  
  // Example export parameters (all optional)
  const exportPayload = {
    fps: 30,
    width: 1080,
    height: 1920,
    // webhookUrl: 'https://donations-publicity-pearl-bomb.trycloudflare.com/webhook/submagic'
  };

  try {
    console.log('🚀 Testing project export...');
    console.log('Project ID:', projectId);
    console.log('Export payload:', JSON.stringify(exportPayload, null, 2));

    // Method 1: Using the Submagic controller endpoint
    // console.log('\n📤 Testing Submagic controller export endpoint...');
    // const response1 = await axios.post(`${baseUrl}/export/${projectId}`, exportPayload, {
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // });

    // console.log('✅ Submagic controller response:', response1.data);

    // Method 2: Using the Project controller endpoint
    console.log('\n📤 Testing Project controller export endpoint...');
    const response2 = await axios.post(`${baseUrl}/export/${projectId}`, exportPayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Project controller response:', response2.data);

    // Test with minimal payload (all parameters are optional)
    // console.log('\n📤 Testing with minimal payload...');
    // const minimalPayload = {};
    // const response3 = await axios.post(`${baseUrl}/export/${projectId}`, minimalPayload, {
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // });

    // console.log('✅ Minimal payload response:', response3.data);

  } catch (error: any) {
    console.error('❌ Error exporting project:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('💡 Tip: Make sure the project ID exists and belongs to your account');
    } else if (error.response?.status === 400) {
      console.log('💡 Tip: Check if the project is ready for export (transcribed and not uploading)');
    }
  }
}

// Test with different export configurations
async function testDifferentExportConfigurations() {
  const baseUrl = 'http://localhost:3000';
  const projectId = 'd2a2e3fa-0562-4f5a-a13c-21f613212d26';

  const configurations = [
    {
      name: 'High Quality 4K',
      payload: { fps: 60, width: 3840, height: 2160 }
    },
    {
      name: 'Standard HD',
      payload: { fps: 30, width: 1920, height: 1080 }
    },
    {
      name: 'Mobile Optimized',
      payload: { fps: 30, width: 1080, height: 1920 }
    },
    {
      name: 'With Webhook',
      payload: { 
        fps: 30, 
        width: 1080, 
        height: 1920,
        webhookUrl: 'https://your-server.com/webhook/export-complete'
      }
    }
  ];

  for (const config of configurations) {
    try {
      console.log(`\n🎬 Testing ${config.name} configuration...`);
      console.log('Payload:', JSON.stringify(config.payload, null, 2));
      
      const response = await axios.post(`${baseUrl}/export/${projectId}`, config.payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ ${config.name} export started:`, response.data);
      
      // Wait a bit between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(`❌ Error with ${config.name}:`, error.response?.data || error.message);
    }
  }
}

// Instructions for usage
console.log(`
📋 Instructions for Project Export:
1. Start your NestJS server: npm run start:dev
2. Make sure you have a completed project (transcribed and not uploading)
3. Replace 'your-project-id-here' with an actual project ID
4. Optionally set up a webhook URL to receive export completion notifications
5. Run this script: npx ts-node test-export-project.ts

🎯 Available Endpoints:
- POST /export/:projectId (Submagic controller)
- POST /project/:projectId/export (Project controller)

📝 Export Parameters (all optional):
- fps: Frames per second (1-60, defaults to original or 30)
- width: Video width in pixels (100-4000, defaults to original or 1080)
- height: Video height in pixels (100-4000, defaults to original or 1920)
- webhookUrl: URL to receive completion notification

⚠️ Prerequisites:
- Project must be transcribed (have words data)
- Project must not be in "uploading" status
- Project must belong to your authenticated account
- Project must be created via API

🔍 Export Status Tracking:
After triggering export, you can:
1. Monitor progress: GET /v1/projects/{id}
2. Check for downloadUrl and directUrl fields once rendering is complete
3. Receive webhook notification if webhookUrl was provided
`);

// Uncomment the lines below to run the tests
testExportProject();
// testDifferentExportConfigurations();