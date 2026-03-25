<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('DATA_FILE',    __DIR__ . '/products.json');
define('UPLOAD_DIR',   __DIR__ . '/uploads/');
define('SELLER_CODE',  'HOSTINGER2026');
define('MAX_IMG_SIZE', 5 * 1024 * 1024); // 5 MB

// ── helpers ──────────────────────────────────────────────────────────────────

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function error(string $msg, int $code = 400): void {
    respond(['ok' => false, 'error' => $msg], $code);
}

function load_products(): array {
    if (!file_exists(DATA_FILE)) return [];
    $raw = file_get_contents(DATA_FILE);
    return json_decode($raw, true) ?? [];
}

function save_products(array $products): void {
    if (!file_exists(DATA_FILE)) {
        file_put_contents(DATA_FILE, json_encode([], JSON_PRETTY_PRINT));
    }
    file_put_contents(DATA_FILE, json_encode(array_values($products), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function auth(): void {
    $code = $_POST['code'] ?? $_GET['code'] ?? '';
    if ($code !== SELLER_CODE) error('Code d\'accès invalide.', 401);
}

function sanitize(string $val, int $max = 500): string {
    return mb_substr(trim(strip_tags($val)), 0, $max);
}

function upload_file(array $file, string $prefix): string {
    if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);

    $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed_img   = ['jpg','jpeg','png','webp','gif'];
    $allowed_video = ['mp4','webm','mov'];
    $allowed = array_merge($allowed_img, $allowed_video);

    if (!in_array($ext, $allowed)) error('Type de fichier non autorisé : ' . $ext);
    if ($file['size'] > MAX_IMG_SIZE) error('Fichier trop lourd (max 5 Mo).');

    $name = $prefix . '_' . uniqid() . '.' . $ext;
    $dest = UPLOAD_DIR . $name;
    if (!move_uploaded_file($file['tmp_name'], $dest)) error('Erreur lors de l\'upload.');

    $type = in_array($ext, $allowed_video) ? 'video' : 'image';
    return json_encode(['type' => $type, 'src' => 'uploads/' . $name]);
}

// ── router ───────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? $_POST['action'] ?? '';

switch ($action) {

    // ── PUBLIC ────────────────────────────────────────────────────────────────

    case 'list':
        respond(['ok' => true, 'products' => load_products()]);

    // ── PROTECTED ─────────────────────────────────────────────────────────────

    case 'save':
        auth();
        $products = load_products();

        $id    = sanitize($_POST['id'] ?? '');
        $name  = sanitize($_POST['name'] ?? '');
        $desc  = sanitize($_POST['desc'] ?? '', 1000);
        $cat   = sanitize($_POST['category'] ?? 'home');
        $price = max(0, intval($_POST['price'] ?? 0));
        $stock = in_array($_POST['stock'] ?? '', ['local','special']) ? $_POST['stock'] : 'local';
        $qty   = max(0, intval($_POST['qty'] ?? 0));

        if (!$name) error('Le nom du produit est requis.');

        // Build media array
        $media = [];

        // Images
        if (!empty($_FILES['images']['name'][0])) {
            foreach ($_FILES['images']['tmp_name'] as $i => $tmp) {
                if ($_FILES['images']['error'][$i] !== UPLOAD_ERR_OK) continue;
                $file = [
                    'name'     => $_FILES['images']['name'][$i],
                    'tmp_name' => $tmp,
                    'size'     => $_FILES['images']['size'][$i],
                ];
                $media[] = json_decode(upload_file($file, 'img'), true);
            }
        }

        // Video
        if (!empty($_FILES['video']['tmp_name']) && $_FILES['video']['error'] === UPLOAD_ERR_OK) {
            $media[] = json_decode(upload_file($_FILES['video'], 'vid'), true);
        }

        // If editing and no new files: keep existing media
        if (empty($media) && $id) {
            $existing = array_filter($products, fn($p) => $p['id'] === $id);
            if ($existing) {
                $media = array_values($existing)[0]['media'] ?? [];
            }
        }

        $product = [
            'id'       => $id ?: 'prod_' . uniqid(),
            'name'     => $name,
            'desc'     => $desc,
            'category' => $cat,
            'price'    => $price,
            'stock'    => $stock,
            'qty'      => $qty,
            'media'    => $media,
            'updated'  => date('c'),
        ];

        // Replace or append
        $idx = array_search($id, array_column($products, 'id'));
        if ($idx !== false) {
            $products[$idx] = $product;
        } else {
            $products[] = $product;
        }

        save_products($products);
        respond(['ok' => true, 'product' => $product]);

    case 'delete':
        auth();
        $id = sanitize($_POST['id'] ?? '');
        if (!$id) error('ID manquant.');

        $products = load_products();
        $filtered = array_filter($products, fn($p) => $p['id'] !== $id);

        if (count($filtered) === count($products)) error('Produit introuvable.');

        save_products($filtered);
        respond(['ok' => true]);

    case 'update_qty':
        auth();
        $id    = sanitize($_POST['id'] ?? '');
        $delta = intval($_POST['delta'] ?? 0);
        if (!$id) error('ID manquant.');

        $products = load_products();
        foreach ($products as &$p) {
            if ($p['id'] === $id) {
                $p['qty'] = max(0, intval($p['qty'] ?? 0) + $delta);
                save_products($products);
                respond(['ok' => true, 'qty' => $p['qty']]);
            }
        }
        error('Produit introuvable.');

    case 'verify_code':
        $code = $_POST['code'] ?? '';
        respond(['ok' => $code === SELLER_CODE]);

    default:
        error('Action inconnue.', 404);
}