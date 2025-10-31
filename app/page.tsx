export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center space-y-8 p-8">
        <h1 className="text-6xl font-bold text-gray-900">
          PronoHub
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl">
          Créez et participez à des tournois de pronostics sportifs avec vos amis
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
            Créer un tournoi
          </button>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            Rejoindre un tournoi
          </button>
        </div>
      </div>
    </main>
  );
}
