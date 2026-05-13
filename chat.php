<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

$GROQ_API_KEY = '';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }
if (!$GROQ_API_KEY) { http_response_code(500); echo json_encode(['error' => 'API key not configured']); exit; }

$body = json_decode(file_get_contents('php://input'), true);
$userMessage = trim(substr($body['message'] ?? '', 0, 500));
if (!$userMessage) { http_response_code(400); echo json_encode(['error' => 'Empty message']); exit; }

$systemPrompt = 'You are Bagani AI, the helpful assistant for Bagani Oil — a premium Filipino lubricants brand made in the Philippines. Answer questions about Bagani Oil products, usage, compatibility, and help customers pick the right oil. Product lines: AMIHAN (Motorcycle Oils): 4T Gale 10W-40, 4T Gust SAE 40, 4T Tempest 20W-50/20W-40. LAON (Engine Oils): Burst 15W-40, Core SAE 10W/30/40/50. AMAN (Gear Oils): Deep SAE 90/140. ANITUN (Transmission): DXIII ATF. HANAN (Gasoline): Raze 20W-50. Be friendly and helpful. Use a warm Filipino tone. Keep replies to 2-4 sentences. If the customer needs pricing, bulk orders, or wants a real person — end with exactly: SUGGEST_MESSENGER';

$payload = json_encode(['model'=>'llama-3.1-8b-instant','messages'=>[['role'=>'system','content'=>$systemPrompt],['role'=>'user','content'=>$userMessage]],'max_tokens'=>300,'temperature'=>0.7]);

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>$payload, CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$GROQ_API_KEY], CURLOPT_TIMEOUT=>25, CURLOPT_SSL_VERIFYPEER=>false]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$result || $httpCode !== 200) { http_response_code(502); echo json_encode(['error' => 'AI unavailable', 'status' => $httpCode]); exit; }

$data = json_decode($result, true);
$reply = trim($data['choices'][0]['message']['content'] ?? '');
$suggestMessenger = strpos($reply, 'SUGGEST_MESSENGER') !== false;
$reply = trim(str_replace('SUGGEST_MESSENGER', '', $reply));
echo json_encode(['reply' => $reply ?: "Sorry, I could not generate a response.", 'suggestMessenger' => $suggestMessenger]);
