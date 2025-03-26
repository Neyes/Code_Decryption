#include <iostream>
#include <sstream>
#include <string>
#include <unordered_map>

std::unordered_map<std::string, char> morseToChar = {
   {".-", 'A'},    {"-...", 'B'},  {"-.-.", 'C'},
   {"-..", 'D'},   {".", 'E'},     {"..-.", 'F'},
   {"--.", 'G'},   {"....", 'H'},  {"..", 'I'},
   {".---", 'J'},  {"-.-", 'K'},   {".-..", 'L'},
   {"--", 'M'},    {"-.", 'N'},    {"---", 'O'},
   {".--.", 'P'},  {"--.-", 'Q'},  {".-.", 'R'},
   {"...", 'S'},   {"-", 'T'},     {"..-", 'U'},       //모스코드 맵, 디코딩 시 찾기 위한 용도
   {"...-", 'V'},  {".--", 'W'},   {"-..-", 'X'},
   {"-.--", 'Y'},  {"--..", 'Z'},
   {"-----", '0'}, {".----", '1'}, {"..---", '2'},
   {"...--", '3'}, {"....-", '4'}, {".....", '5'},
   {"-....", '6'}, {"--...", '7'}, {"---..", '8'},
   {"----.", '9'}
};

//모스코드
std::string Morsecode_decoded(const std::string& Morse_code) {

    std::istringstream stream(Morse_code);

    std::string token, result;

    while (stream >> token) {
        if (morseToChar.find(token) != morseToChar.end()) {
            result += morseToChar[token];
        }
        else {
            result += '?';
        }
    }

    return result;

}
//시저 암호
std::string caesarDecode(const std::string& input, int shift) {
    std::string result;

    for (char ch : input) {
        if (isalpha(ch)) {
            char base = isupper(ch) ? 'A' : 'a';
            char decoded = (ch - base - shift + 26) % 26 + base;
            result += decoded;
        }
        else {
            result += ch;
        }
    }

    return result;
}

int main(void) {
    int number;
    std::cout << "어느 방식으로 디코딩 하시길 원하시나요?\n 1.Morse code\n 2.Ceaser Cipher";

    std::cin >> number;

    std::cin.ignore(); //getline과 cin의 겹침으로 인한 오류 발생 가능성 제거



    if (number == 1) {

        std::cout << "모스코드를 입력하십시요." << std::endl;

        std::string morseInput;
        std::getline(std::cin, morseInput);

        std::string decoded = Morsecode_decoded(morseInput);
        std::cout << "디코딩 결과: " << decoded << std::endl;



    }
    else if (number == 2) {
        std::cin.ignore(); // 버퍼 정리
        std::string caesarInput;
        int shift;

        std::cout << "시저 암호 문장을 입력하세요:\n";
        std::getline(std::cin, caesarInput);

        std::cout << "몇 칸 이동되었나요? (예: 3)\n";
        std::cin >> shift;

        std::string decoded = caesarDecode(caesarInput, shift);
        std::cout << "디코딩 결과: " << decoded << std::endl;
    }

    return 0;
}
