<?php
// Endpoint desativado. Nao faz parte do fluxo de pagamento atual.
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => true, 'message' => 'Not found']);
exit;
