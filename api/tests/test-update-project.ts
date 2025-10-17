import axios from 'axios';

// Test script to demonstrate project update functionality
async function testUpdateProject() {
  const baseUrl = 'http://localhost:3000';
  
  // Example project ID (replace with actual project ID from your batch)
  const projectId = 'd2a2e3fa-0562-4f5a-a13c-21f613212d26';
  
  // Example B-roll items
  const updatePayload = {
    items: [
      {
        startTime: 10.5,
        endTime: 15.2,
        userMediaId: '2b1c0b2e-68e5-46a2-9aa3-184c8eba99e4'
      },
      {
        startTime: 25.0,
        endTime: 30.8,
        userMediaId: 'a5be0606-00b3-4bc4-8e6f-7f9829208c09'
      }
    ]
  };

  try {
    console.log('🚀 Testing project update...');
    console.log('Project ID:', projectId);
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

    // Method 1: Using the Submagic controller endpoint
    // const response1 = await axios.patch(`${baseUrl}/update/${projectId}`, updatePayload, {
    //   headers: {
    //     'Content-Type': 'application/json'
    //   }
    // });

    // console.log('✅ Submagic controller response:', response1.data);

    // Method 2: Using the Project controller endpoint
    const response2 = await axios.post(`${baseUrl}/project/${projectId}/update`, updatePayload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Project controller response:', response2.data);

  } catch (error: any) {
    console.error('❌ Error updating project:', error.response?.data || error.message);
  }
}

// Instructions for usage
console.log(`
📋 Instructions:
1. Start your NestJS server: npm run start:dev
2. Create a batch with magicBrolls: false
3. Replace 'your-project-id-here' with an actual project ID
4. Replace the userMediaId values with actual media IDs from your Submagic library
5. Run this script: npx ts-node test-update-project.ts

🔍 To find your userMediaId:
- Go to the Submagic editor
- Navigate to the 'B-roll' tab
- Add a B-roll to access your media library
- Go to the 'My videos' tab
- Each video will display its unique media ID
`);

// Uncomment the line below to run the test
testUpdateProject();