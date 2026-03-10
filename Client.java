
import java.net.*;
import java.io.*;

public class Client {

    private Socket socket = null;
    private BufferedReader input = null;
    private DataOutputStream out = null;

    public Client(String address, int port) {

        try {
            socket = new Socket(address, port);
            System.out.println("Connected");

            input = new BufferedReader(
                    new InputStreamReader(System.in));

            out = new DataOutputStream(socket.getOutputStream());

            String line = "";

            while (!line.equals("Over")) {

                line = input.readLine();
                out.writeUTF(line);
            }

            input.close();
            out.close();
            socket.close();

        } catch (IOException i) {
            System.out.println(i);
        }
    }

    public static void main(String args[]) {
        new Client("127.0.0.1", 5000);
    }
}