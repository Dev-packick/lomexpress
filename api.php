<?php
header('Content-Type: application/json');

// --- CONFIGURATION ---
$host = 'localhost';
$db   = 'lomexpress';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    echo json_encode(['ok' => false, 'error' => "Erreur BDD"]);
    exit;
}

$action = $_REQUEST['action'] ?? '';

// --- LISTER LES PRODUITS ---
if ($action === 'list') {
    $stmt = $pdo->query("SELECT * FROM products ORDER BY id DESC");
    $rows = $stmt->fetchAll();
    
    foreach ($rows as &$r) {
        $r['id'] = (string)$r['id'];
        $r['media'] = json_decode($r['images'], true) ?: [];
        $r['stock'] = $r['stock'] ?? 'local';
        // AJOUT DE CETTE LIGNE : On crée 'desc' pour le JS à partir de 'description'
        $r['desc'] = $r['description'] ?? '';
    }
    echo json_encode(['ok' => true, 'products' => $rows]);
}

// --- ENREGISTRER (AJOUT / MODIF) ---
if ($action === 'save') {
    $id = $_POST['id'] ?? '';
    $name = $_POST['name'];
    $price = $_POST['price'];
    $qty = $_POST['qty'];
    $cat = $_POST['category'];
    $desc = $_POST['desc'];
    
    $uploadedImages = [];
    if (!empty($_FILES['images']['name'][0])) {
        if (!is_dir('uploads')) mkdir('uploads', 0777, true);
        foreach ($_FILES['images']['tmp_name'] as $key => $tmpName) {
            $fileName = time() . "_" . $_FILES['images']['name'][$key];
            move_uploaded_file($tmpName, "uploads/" . $fileName);
            $uploadedImages[] = ['src' => "uploads/" . $fileName, 'type' => 'image'];
        }
    }

    if ($id) {
        if (empty($uploadedImages)) {
            $sql = "UPDATE products SET name=?, price=?, qty=?, category=?, description=? WHERE id=?";
            $pdo->prepare($sql)->execute([$name, $price, $qty, $cat, $desc, $id]);
        } else {
            $imgJson = json_encode($uploadedImages);
            $sql = "UPDATE products SET name=?, price=?, qty=?, category=?, description=?, images=? WHERE id=?";
            $pdo->prepare($sql)->execute([$name, $price, $qty, $cat, $desc, $imgJson, $id]);
        }
    } else {
        $imgJson = json_encode($uploadedImages);
        $sql = "INSERT INTO products (name, price, qty, category, description, images) VALUES (?,?,?,?,?,?)";
        $pdo->prepare($sql)->execute([$name, $price, $qty, $cat, $desc, $imgJson]);
    }
    echo json_encode(['ok' => true]);
}

// --- SUPPRIMER ---
if ($action === 'delete') {
    $id = $_POST['id'];
    $pdo->prepare("DELETE FROM products WHERE id = ?")->execute([$id]);
    echo json_encode(['ok' => true]);
}
?>